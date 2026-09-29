# 서버 액션과 데이터 변경

**서버 액션(Server Action)** 은 `<form action>`, `<button formAction>`, 또는 클라이언트 사이드 트랜지션 같은 React의 액션 메커니즘을 통해 호출되는 [React 서버 함수](https://react.dev/reference/rsc/server-functions)입니다.

서버 액션은 [`'use server'`](/docs/app/api-reference/directives/use-server) 지시어를 추가해 만들고, 폼에서 호출하거나 `startTransition`으로 감싼 이벤트 핸들러 또는 `useEffect`에서 호출합니다. 서버 함수를 만들고 호출하는 기본 내용은 [데이터 변경](/docs/app/getting-started/mutating-data)과 [폼 가이드](/docs/app/guides/forms)를 참고하세요.

이 문서는 서버 액션에서 Next.js에 특화된 부분을 다룹니다. 서버 액션이 데이터 변경과 어떻게 대응되는지, 하나의 응답이 반환값과 다시 렌더링된 UI를 어떻게 함께 전달하는지, 클라이언트가 이를 어떻게 디스패치하는지, 프레임워크가 강제하는 보안 경계는 무엇인지, 그리고 어떤 설정이 가능한지를 설명합니다.

## 클라이언트에서의 순차 디스패치

Next.js는 클라이언트당 한 번에 하나씩 서버 액션을 디스패치합니다. 사용자가 세 개의 액션을 빠르게 연달아 실행하면, 두 번째는 첫 번째가 끝날 때까지 기다리고 세 번째는 두 번째가 끝날 때까지 기다립니다. 이렇게 해야 다시 렌더링된 서버 트리가 그 결과를 만들어낸 액션과 일관된 상태를 유지합니다.

여기서 따라오는 결론이 하나 있습니다. 클라이언트에서 `Promise.all`로 서버 액션을 병렬화하려 해서는 안 됩니다. 병렬 작업이 필요하다면 하나의 서버 액션 안에서 처리하거나, [서버 컴포넌트](/docs/app/getting-started/fetching-data#server-components)에서 병렬로 가져오거나, 데이터 변경이 아닌 요청에는 [라우트 핸들러](/docs/app/guides/backend-for-frontend#manipulating-data)를 사용하세요.

> **알아두기:** 이것은 클라이언트 디스패처의 특성이지, 서버 함수 일반의 특성이 아닙니다. 서버 측에서 액션은 각자의 요청으로 실행되며 async 함수가 할 수 있는 모든 일을 할 수 있습니다.

## 하나의 응답이 데이터와 UI를 함께 전달합니다

서버 액션이 즉시 재검증을 유발하면 Next.js는 하나의 HTTP 요청 안에서 그 작업을 처리합니다. 액션을 실행한 다음, 현재 라우트를 서버에서 다시 렌더링합니다. 돌아오는 응답에는 두 가지가 같은 Flight 스트림에 담겨 있습니다.

- 클라이언트에서 `useActionState` 또는 await한 프로미스로 소비되는 액션의 반환값.
- 현재 라우트를 새로 렌더링한 [RSC 페이로드](/docs/app/glossary#rsc-payload). 클라이언트는 이를 시드된 내비게이션으로 커밋합니다.

현재 페이지의 갱신된 UI를 보기 위해 애플리케이션 코드에서 후속 fetch를 따로 할 필요가 없습니다.

액션이 다음 중 하나라도 수행하면 같은 응답에 재렌더링 결과가 포함됩니다.

- 캐시된 데이터를 즉시 무효화하기 위해 [`updateTag`](/docs/app/api-reference/functions/updateTag) 또는 [`revalidatePath`](/docs/app/api-reference/functions/revalidatePath)를 호출할 때.
- 현재 라우트의 RSC 페이로드를 다시 가져오기 위해 [`refresh`](/docs/app/api-reference/functions/refresh)를 호출할 때.
- [`cookies()`](/docs/app/api-reference/functions/cookies#understanding-cookie-behavior-in-server-functions)를 통해 쿠키를 변경할 때. 쿠키를 설정하거나 삭제하면 UI가 새 값을 반영하도록 현재 페이지가 자동으로 다시 렌더링됩니다.
- [`redirect`](/docs/app/api-reference/functions/redirect)를 호출할 때. 응답이 라우터를 이동시키고 목적지의 RSC 페이로드를 스트리밍합니다.

```ts filename="app/posts/actions.ts"
'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

export async function createPost(formData: FormData) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  await db.post.create({
    data: {
      title: String(formData.get('title')),
      authorId: session.user.id,
    },
  })

  revalidatePath('/posts')
}
```

데이터 변경, 캐시 무효화, 페이지 재렌더링이 모두 한 번의 왕복에서 완료됩니다. [`redirect`](/docs/app/api-reference/functions/redirect#behavior)는 제어 흐름 예외를 던지므로 그 뒤의 코드는 실행되지 않습니다. 목적지에서 최신 데이터가 필요하다면 재검증 호출을 `redirect`보다 앞에 두세요.

stale-while-revalidate 프로필을 사용하는 [`revalidateTag`](/docs/app/api-reference/functions/revalidateTag)는 예외입니다. 태그를 백그라운드 갱신 대상으로 표시할 뿐, 액션 응답에 재렌더링을 포함하지 **않습니다**. 페이지는 이후의 읽기에서 변경 사항을 반영합니다. 위의 어떤 동작도 하지 않는 액션은 반환값만 전달하며, 현재 라우트는 다시 렌더링되지 않습니다.

## 보안

서버 액션은 그것을 호출한 페이지에 대한 POST 요청으로 실행됩니다. 빌드 시점에 `'use server'` 지시어는, 클라이언트 번들에 있는 함수 구현을 서버로 POST를 보내는 참조(액션 ID와 디스패처)로 바꾸도록 컴파일러에 지시합니다. 구현은 서버에 남지만, 그 라우트는 동일한 POST를 보낼 수 있는 누구에게나 도달 가능합니다. 모든 액션을 신뢰할 수 없는 진입점으로 취급하세요.

Next.js는 프레임워크 수준의 보호 장치를 몇 가지 강제합니다.

- **CSRF 검사.** 요청의 `Origin`을 `Host`(또는 `X-Forwarded-Host`)와 비교합니다. 일치하지 않으면 거부합니다. 프록시나 CDN 도메인은 [`serverActions.allowedOrigins`](/docs/app/api-reference/config/next-config-js/serverActions#allowedorigins)로 설정하세요.
- **본문 크기 제한.** 액션 요청은 기본적으로 1MB로 제한됩니다. 더 큰 페이로드를 받아야 한다면 [`serverActions.bodySizeLimit`](/docs/app/api-reference/config/next-config-js/serverActions#bodysizelimit)을 설정하세요.
- **액션 ID 암호화와 데드 코드 제거.** 액션 참조는 빌드 시점에 암호화되고, 사용하지 않는 서버 함수는 클라이언트 번들에서 제거되어 공개 엔드포인트를 갖지 않습니다. [내장 서버 액션 보안 기능](/docs/app/guides/data-security#built-in-server-actions-security-features)을 참고하세요.
- **클로저 변수 암호화.** 인라인 액션이 캡처한 변수는 클라이언트로 전송되기 전에 암호화됩니다. 다중 인스턴스 및 셀프 호스팅 배포에서는 `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`를 인스턴스 간에 공유되는 고정 키로 설정하세요. [클로저와 암호화](/docs/app/guides/data-security#closures-and-encryption)를 참고하세요.

프레임워크의 보호 장치가 애플리케이션 수준의 검사를 대신하지는 않습니다. 모든 액션 안에서 다음을 수행하세요.

- **인증과 인가.** 렌더링 시점의 차단(인증된 페이지에서만 폼을 렌더링하는 것)은 보안 경계가 아닙니다. UI를 거치지 않고도 요청을 보낼 수 있기 때문입니다.
- **입력 검증.** `FormData`, 쿼리 파라미터, 헤더를 신뢰할 수 없는 값으로 취급하세요.
- **반환값 제한.** 액션의 반환값은 클라이언트로 직렬화됩니다. 원시 데이터베이스 레코드가 아니라 UI가 렌더링하는 형태로 다듬으세요.

데이터 접근 계층(Data Access Layer), 반환값 테인팅, 레이트 리미팅을 포함한 전 구간 패턴은 [데이터 보안 가이드](/docs/app/guides/data-security#mutating-data)를 참고하세요.

삭제처럼 파괴적인 작업에는 상향된 세션 검사나 재인증 같은 더 강한 처리와, 그 검사를 통과하지 못했을 때의 명확한 실패가 필요할 수 있습니다.

```ts filename="app/posts/actions.ts" highlight={6,7,8}
'use server'

import { auth } from '@/lib/auth'

export async function deletePost(postId: string) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')
  if (!(await canDelete(session.user, postId))) throw new Error('Forbidden')

  await db.post.delete({ where: { id: postId } })
}
```

실험적 [`authInterrupts`](/docs/app/api-reference/config/next-config-js/authInterrupts) 플래그를 활성화했다면 대신 `next/navigation`의 [`unauthorized()`](/docs/app/api-reference/functions/unauthorized)와 [`forbidden()`](/docs/app/api-reference/functions/forbidden)을 던질 수 있습니다. 그러면 Next.js가 대응하는 `unauthorized.tsx` / `forbidden.tsx` UI 세그먼트를 자동으로 렌더링합니다.

예를 들어 클라이언트가 서버에 _어떤_ 항목을 대상으로 할지 알려주는 것은 정당하지만, 그 행의 내용이나 소유권까지 제공해서는 안 됩니다. 참조(보통 ID)와 사용자의 변경 사항을 보내고, 나머지는 세션을 사용해 신뢰할 수 있는 소스에서 다시 읽으세요. 스키마 검증(zod 등)은 입력의 _형태_ 만 검사합니다. 형식이 올바른 `Item` 객체라도 호출자가 소유하지 않은 행을 가리킬 수 있습니다.

```ts filename="app/items/actions.ts"
'use server'

import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

// 안전하지 않음: 인증도 소유권 검사도 없습니다. id를 포함한 항목 전체가
// 클라이언트에서 오므로, 여기로 POST할 수 있는 누구나 임의의 항목을 완료 처리할 수 있습니다.
export async function completeItemUnsafe(item: Item) {
  await db.item.update({ where: { id: item.id }, data: { completed: true } })
}

// 안전함: 변경 사항만 받고, 신원은 세션에서 도출하며, 소유권으로 조회합니다.
export async function completeItem(itemId: string) {
  const session = await auth()
  if (!session?.user) return

  const item = await db.item.findFirst({
    where: { id: itemId, ownerId: session.user.id },
  })
  if (!item) return

  await db.item.update({ where: { id: item.id }, data: { completed: true } })
}
```

## 캐시 갱신 방식 선택하기

데이터를 변경한 뒤, 온디맨드 재검증은 서버 캐시나 클라이언트 라우터, 또는 둘 다를 갱신합니다. 무엇이 바뀌어야 하는지에 따라 선택하세요.

- [`updateTag`](/docs/app/api-reference/functions/updateTag): 태그를 즉시 만료시킵니다. 다음 읽기(액션 응답과 함께 전달되는 라우트 재렌더링 포함)는 최신 데이터를 기다립니다. 사용자가 자신의 변경을 즉시 확인해야 하는 **read-your-own-writes**가 필요할 때 사용하세요. 서버 액션에서만 사용할 수 있습니다.
- [`revalidateTag`](/docs/app/api-reference/functions/revalidateTag): 캐시 라이프 프로필을 적용해 태그를 stale-while-revalidate 방식으로 갱신합니다. 이후의 읽기는 백그라운드에서 새로 가져오는 동안 오래된 값을 받으므로, 액션 자체의 재렌더링은 새 데이터를 기다리지 **않습니다**.
- [`revalidatePath`](/docs/app/api-reference/functions/revalidatePath): URL 경로 기준으로 무효화합니다. 영향받는 라우트가 하나뿐이고 태깅이 과할 때 사용하세요.
- [`refresh`](/docs/app/api-reference/functions/refresh): 캐시된 데이터를 무효화하지 않고 현재 라우트의 RSC 페이로드만 다시 가져옵니다. 액션이 방금 바꾼, 캐시 바깥의 상태에 뷰가 의존할 때 사용하세요.

`updateTag`, `revalidatePath`, `refresh`가 실행되면 Next.js는 현재 라우트를 서버에서 다시 렌더링하고 새로 렌더링한 [RSC 페이로드](/docs/app/glossary#rsc-payload)를 액션 응답에 포함하므로, 페이지가 같은 왕복에서 변경을 반영합니다. stale-while-revalidate 프로필의 `revalidateTag`는 의도적으로 그 즉시 재렌더링을 건너뜁니다.

[`redirect`](/docs/app/api-reference/functions/redirect)와 달리 이들 중 어느 것도 예외를 던지지 않으므로, 액션은 이들을 호출하고도 호출자에게 값을 반환할 수 있습니다. 기반이 되는 모델은 [재검증 동작 방식](/docs/app/guides/how-revalidation-works)을 참고하세요.

## 설정

`next.config.js`의 [`serverActions`](/docs/app/api-reference/config/next-config-js/serverActions) 옵션이 프레임워크 수준 동작을 제어합니다.

```js filename="next.config.js"
/** @type {import('next').NextConfig} */
module.exports = {
  experimental: {
    serverActions: {
      allowedOrigins: ['my-proxy.com', '*.my-proxy.com'],
      bodySizeLimit: '2mb',
    },
  },
}
```

클로저 암호화 키는 배포 환경에서 `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`로 설정하세요. 배포 환경별 안내는 [셀프 호스팅: 서버 함수 암호화 키](/docs/app/guides/self-hosting#server-functions-encryption-key)를 참고하세요.

## 배포 시 고려사항

각 서버 액션은 빌드 산출물의 일부인 [액션 ID](#보안)로 식별됩니다. 새로운 배포는 보통 새로운 ID를 생성하므로(소스가 그대로여도 Next.js는 최대 14일마다 ID를 교체합니다), 이전 빌드를 실행 중인 클라이언트가 더 이상 존재하지 않는 액션 ID를 호출할 수 있습니다. 이 오류는 "[Failed to find Server Action](https://nextjs.org/docs/messages/failed-to-find-server-action)"으로 나타납니다.

영향을 최소화하려면 다음을 고려하세요.

- 사용자가 데이터 변경 도중일 가능성이 높다면, 급격한 전환보다 롤링 배포를 선호하세요.
- 액션 참조를 어디서든 복호화할 수 있도록 `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`를 인스턴스 간에 동일하게 유지하세요.
- 오류를 하드 실패가 아니라 UI에서 재시도 경로로 노출해, 새로고침으로 복구되게 하세요.

## 정리

**한 줄 요약:** `'use server'`는 함수를 서버에 *숨기는* 것이 아니라, 일반 함수처럼 호출할 수 있는 POST 엔드포인트로 *공개*합니다.

### 흐름

1. 함수에 `'use server'`를 추가해 서버 액션으로 만듭니다.
2. `<form action>`, `<button formAction>`, 또는 `startTransition`으로 감싼 이벤트 핸들러 / `useEffect`에서 호출합니다.
3. Next.js가 이를 큐에 넣어(클라이언트당 한 번에 하나씩) 실행하고, 재검증이 있으면 **같은** 요청 안에서 라우트를 다시 렌더링합니다.
4. 응답이 반환값과 새 RSC 페이로드를 함께 전달합니다. 후속 fetch가 필요 없습니다.

### 흔히 오해하는 점

| 이런 줄 알았지만 | 실제로는 |
| --- | --- |
| `Promise.all`로 액션을 병렬화할 수 있다 | 클라이언트는 한 번에 하나씩 **순차적으로** 디스패치합니다 |
| 변경한 뒤 다시 가져와야 반영된다 | 한 번의 왕복이 데이터와 **다시 렌더링된 UI**를 함께 돌려줍니다 |
| 모든 액션이 페이지를 다시 렌더링한다 | `updateTag` / `revalidatePath` / `refresh` / `redirect`를 호출하거나 쿠키를 변경할 때만 그렇습니다 |
| `revalidateTag`는 즉시 갱신한다 | SWR 프로필에서는 **백그라운드**로 갱신하며, 응답에 재렌더링이 없습니다 |
| `redirect` 뒤의 코드도 실행된다 | `redirect`는 예외를 **던집니다**. 재검증은 그 *앞에* 두세요 |
| 로그인한 사용자에게만 폼을 렌더링하면 액션이 보호된다 | 액션은 공개된 POST 라우트이며, UI는 **보안 경계가 아닙니다** |

### 어떤 재검증을 호출할까

| API | 동작 | 사용할 때 |
| --- | --- | --- |
| `updateTag` | 즉시 만료. 함께 전달되는 재렌더링이 최신 데이터를 **기다립니다** | read-your-own-writes가 필요할 때. 서버 액션 전용 |
| `revalidateTag` | stale-while-revalidate. 백그라운드 갱신 | 변경이 이후의 읽기에 반영되어도 될 때 |
| `revalidatePath` | URL 경로 기준 무효화 | 영향받는 라우트가 하나이고 태깅이 과할 때 |
| `refresh` | 캐시 무효화 없이 RSC 페이로드만 다시 가져오기 | 캐시 바깥의 상태에 뷰가 의존할 때 |

이들 중 어느 것도 예외를 던지지 않으므로, 액션은 여전히 호출자에게 값을 반환할 수 있습니다.

### 보안 체크리스트

Next.js가 기본으로 제공하는 것: CSRF 검사(`Origin`과 `Host` 비교), 1MB 본문 제한, 액션 ID 암호화와 미사용 액션의 번들 제거, 클로저 변수 암호화.

그래도 **모든 액션 안에서** 직접 해야 하는 것:

- **인증과 인가.** UI를 거치지 않고도 요청을 보낼 수 있습니다.
- **입력 검증.** `FormData`, 쿼리 파라미터, 헤더는 모두 신뢰할 수 없습니다.
- **반환값 제한.** 반환값은 클라이언트로 직렬화되므로, 원시 데이터베이스 레코드가 아니라 UI에 맞는 형태로 다듬으세요.

> **꼭 기억할 패턴:** 객체 전체가 아니라 **ID와 사용자의 변경 사항**만 받으세요. 신원은 세션에서 도출하고, 행은 소유권으로 다시 조회합니다. 스키마 검증(zod 등)은 *형태* 만 확인합니다. 형식이 올바른 `Item`이라도 호출자가 소유하지 않은 행을 가리킬 수 있습니다.

### 설정과 배포

- `next.config.js` → `experimental.serverActions`: `allowedOrigins`(프록시 / CDN 도메인), `bodySizeLimit`.
- `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`는 인스턴스 간에 동일해야 하며, 그렇지 않으면 클로저 복호화가 실패합니다.
- 액션 ID는 빌드 산출물입니다. 새 배포는 새 ID를 생성하므로, 이전 빌드를 쓰던 클라이언트가 사라진 ID로 POST할 수 있습니다 → *"Failed to find Server Action."* 롤링 배포를 사용하고, 오류는 하드 실패가 아니라 재시도로 노출하세요.
