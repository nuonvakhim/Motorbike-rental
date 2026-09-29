# 보안

Server Component는 데이터 접근을 UI를 렌더링하는 바로 그 파일 안으로 옮겨 놓았습니다. 그것이 핵심입니다 — 내 데이터베이스를 읽는 데 API 왕복이 필요 없으니까요 — 하지만 동시에 예전에는 분명했던 경계 하나를 지워 버렸습니다. Pages Router에서는 네트워크 요청이 곧 보안 경계였습니다. 브라우저가 가진 것은 모두 브라우저가 요청한 것이었으니까요. App Router에서 경계는 모듈 그래프이고, 의도적으로 눈에 보이게 유지하지 않으면 보이지 않습니다.

이 노트는 그 경계를 보이게 유지하는 방법에 대한 것입니다. 데이터를 어디서 읽어도 되는지, 무엇이 클라이언트로 넘어가도 되는지, Server Action이 실제로 어떻게 호출될 수 있는지, 그리고 이 모든 것 앞에 놓이는 헤더를 다룹니다. 인증 자체 — 세션, 쿠키, 로그인 흐름 — 은 [NextJs_Authentication.md](NextJs_Authentication.md)에 있으며 여기서 반복하지 않습니다.

## 데이터 페칭 방식은 하나만 고르세요

방식은 세 가지이며, 문서는 **하나**를 골라 섞지 말 것을 명시적으로 권합니다. 그래야 다음 개발자도, 감사자도 무엇을 기대해야 할지 알 수 있기 때문입니다.

| 방식 | 적합한 경우 | 수반되는 위험 |
| --- | --- | --- |
| **외부 HTTP API** | 이미 규모가 있는 앱, 백엔드 팀이 분리된 조직 | 새로 생기는 위험 없음 — 기존 경계를 그대로 유지 |
| **Data Access Layer (DAL)** | 신규 프로젝트 | 처음 세우는 데 규율이 필요하지만, 이후에는 스스로 강제됨 |
| **컴포넌트 수준 접근** | 프로토타입과 학습 | 비공개 필드를 클라이언트로 흘리기 가장 쉬움 |

### 외부 HTTP API

앞단에 인증이 붙은 REST나 GraphQL 엔드포인트가 이미 있다면 계속 호출하세요. Server Component도 Client Component가 그랬듯 그대로 `fetch`할 수 있고, 세션 쿠키를 전달하면 됩니다.

```tsx filename="app/page.tsx"
import { cookies } from 'next/headers'

export default async function Page() {
  const cookieStore = await cookies()
  const token = cookieStore.get('AUTH_TOKEN')?.value

  const res = await fetch('https://api.example.com/profile', {
    headers: {
      Cookie: `AUTH_TOKEN=${token}`,
    },
  })

  // ...
}
```

이것이 **Zero Trust** 선택지입니다. UI를 렌더링하는 서버가 브라우저보다 더 많은 권한을 갖지 않습니다. 기존 시스템에 Server Component를 도입할 때의 올바른 기본값입니다.

### Data Access Layer

새 프로젝트라면 DAL을 만드세요. 코드베이스에서 데이터베이스를 건드릴 수 있는 유일한 내부 모듈입니다. 하는 일은 세 가지입니다 — 서버에서**만** 실행되고, **인가(authorization)** 검사를 수행하고, 데이터베이스 행이 아니라 최소한의 **Data Transfer Object (DTO)** 를 반환하는 것.

```ts filename="data/auth.ts"
import { cache } from 'react'
import { cookies } from 'next/headers'

// 캐시된 헬퍼를 쓰면 같은 값을 여러 곳에서 쉽게 읽을 수 있습니다.
// Server Component에서 Server Component로 값을 넘기지 않아도 되는데,
// 결국 그렇게 넘기다가 Client Component까지 흘러가는 것입니다.
export const getCurrentUser = cache(async () => {
  const cookieStore = await cookies()
  const token = cookieStore.get('AUTH_TOKEN')
  const decodedToken = await decryptAndValidate(token)
  // 비밀 토큰이나 비공개 정보를 공개 필드에 넣지 마세요.
  // 클래스를 쓰면 객체 전체가 실수로 클라이언트에 넘어가지 않습니다.
  return new User(decodedToken.id)
})
```

DTO 계층은 프라이버시 규칙이 사는 곳입니다. 현재 사용자를 인자로 받지 않고 캐시에서 다시 읽는다는 점에 주목하세요 — 호출자가 틀릴 수 있는 지점이 하나 줄어듭니다.

```tsx filename="data/user-dto.tsx"
import 'server-only'
import { getCurrentUser } from './auth'

function canSeeUsername(viewer: User) {
  // 지금은 공개지만, 바뀔 수 있습니다
  return true
}

function canSeePhoneNumber(viewer: User, team: string) {
  // 프라이버시 규칙
  return viewer.isAdmin || team === viewer.team
}

export async function getProfileDTO(slug: string) {
  // 쿼리를 안전하게 템플릿화하는 데이터베이스 API를 사용하세요
  const [rows] = await sql`SELECT * FROM user WHERE slug = ${slug}`
  const userData = rows[0]

  const currentUser = await getCurrentUser()

  // 전부가 아니라 이 쿼리에 필요한 데이터만 반환합니다
  return {
    username: canSeeUsername(currentUser) ? userData.username : null,
    phonenumber: canSeePhoneNumber(currentUser, userData.team)
      ? userData.phonenumber
      : null,
  }
}
```

그러면 페이지는 어디에 넘겨도 안전하다는 것을 아는 객체만 다루게 됩니다.

```tsx filename="app/page.tsx"
import { getProfileDTO } from '../../data/user-dto'

export default async function Page({ params }) {
  const { slug } = await params
  const profile = await getProfileDTO(slug)
  // ...
}
```

> **알아두면 좋은 점:** 비밀 값은 환경 변수에 두되, **`process.env`를 읽는 것은 Data Access Layer뿐이어야 합니다**. 이 규칙 하나가 "DAL 밖에서 비밀 값을 쓰고 있는가?"를 grep으로 확인 가능한 감사 질문으로 만들어 줍니다.

### 컴포넌트 수준 접근

Server Component에서 바로 쿼리하는 것은 프로토타입에서는 괜찮습니다. 실패 지점은 단 한 줄입니다.

```tsx filename="app/page.tsx"
import Profile from './components/profile.tsx'

export default async function Page({ params }) {
  const { slug } = await params
  const [rows] = await sql`SELECT * FROM user WHERE slug = ${slug}`
  const userData = rows[0]
  // 노출됨: Server Component에서 Client Component로 넘기기 때문에
  // `userData`의 모든 컬럼이 클라이언트로 직렬화됩니다.
  return <Profile user={userData} />
}
```

여기서는 Client Component의 prop 타입도 공범입니다 — `user: User`는 레코드 전체를 넘기라고 서버에게 권하는 셈입니다. prop을 좁히고, 경계를 넘기 전에 정제하세요.

```ts filename="data/user.ts"
import { sql } from './db'

export async function getUser(slug: string) {
  const [rows] = await sql`SELECT * FROM user WHERE slug = ${slug}`
  const user = rows[0]

  // 공개 필드만 반환합니다
  return {
    name: user.name,
  }
}
```

## 실제로 경계를 넘는 것

최초 로드에서는 Server Component와 Client Component가 모두 서버에서 실행되어 HTML을 만듭니다 — 다만 **격리된 모듈 시스템**에서 실행됩니다. 이 격리가 다음 규칙의 실제 메커니즘입니다.

- **Server Component**는 서버에서만 실행되며, 환경 변수, 비밀 값, 데이터베이스, 내부 API를 읽을 수 있습니다.
- **Client Component**는 프리렌더링 중 서버에서 실행되지만, 브라우저 코드와 똑같은 가정 아래 작성되어야 합니다. 특권 데이터나 server-only 모듈에 절대 손을 뻗어서는 안 됩니다.

그래서 앱은 기본적으로 안전합니다. 자동이 *아닌* 것은 여러분이 직접 넘기기로 한 데이터입니다 — props는 직렬화되고, 직렬화된다는 것은 공개된다는 뜻입니다. 함수와 클래스는 이미 넘어가지 못하게 막혀 있지만, 평범한 객체는 그렇지 않습니다. 경계 자체에 대해서는 [NextJs_Server_and_Client_Components.md](NextJs_Server_and_Client_Components.md)를 참고하세요.

### Tainting

React의 Taint API는 첫 번째 그물 아래에 치는 두 번째 그물입니다. `next.config.js`에서 활성화합니다.

```js filename="next.config.js"
module.exports = {
  experimental: {
    taint: true,
  },
}
```

그러면 `experimental_taintObjectReference`는 객체를, `experimental_taintUniqueValue`는 특정 값을 "절대 전송 금지"로 표시합니다. 오염된 것을 클라이언트에 넘기면 유출이 아니라 에러가 됩니다. 심층 방어로만 다루세요 — DAL에서의 필터링을 대체하지 않습니다.

### `server-only`

격리를 런타임의 놀라움이 아니라 **빌드 에러**로 만들려면 서버 모듈을 표시하세요.

```ts filename="lib/data.ts"
import 'server-only'

//...
```

이제 그 모듈을 Client Component에서 import하면 빌드가 실패합니다. Next.js는 이 import를 내부적으로 처리하며 npm 패키지의 내용을 사용하지는 않지만, 린트 규칙이 불필요한 의존성이라고 지적한다면 설치해도 됩니다.

```bash package="npm"
npm install server-only
```

## Server Action은 공개 엔드포인트입니다

이 모델에서 가장 많이 오해받는 부분입니다. **export된 Server Action은 직접 POST 요청으로 호출할 수 있습니다.** UI가 그것을 호출하든 말든 상관없습니다. 그것은 엔드포인트입니다.

Next.js는 피해 범위를 줄이기 위해 두 가지를 합니다.

- **보안 액션 ID** — 클라이언트가 액션을 참조하는 데 쓰는 암호화된 비결정적 ID입니다. 빌드 간에 재계산됩니다(최대 14일 캐시되며, 새 빌드나 빌드 캐시 무효화 시 재생성).
- **데드 코드 제거** — 어디서도 참조하지 않는 액션은 `next build`에서 번들에서 제거되므로 공개 엔드포인트가 생기지 않습니다.

```jsx
// app/actions.js
'use server'

// 앱에서 사용됨 → Next.js가 클라이언트가 호출할 수 있도록 보안 ID를 발급합니다.
export async function updateUserAction(formData) {}

// 어디서도 사용되지 않음 → `next build` 중 제거되며, 공개 엔드포인트가 없습니다.
export async function deleteUserAction(formData) {}
```

둘 다 인가 검사가 아닙니다. 인증 계층이 빠졌을 때 피해를 줄여줄 뿐, 인증 계층 자체가 아닙니다.

### 모든 클라이언트 입력을 검증하세요

폼 데이터, URL 파라미터, 헤더, `searchParams`는 모두 공격자가 조작할 수 있습니다. 이 예제의 두 절반의 차이가 이 절의 전부입니다.

```tsx filename="app/page.tsx"
// 나쁨: searchParams를 그대로 신뢰
export default async function Page({ searchParams }) {
  const isAdmin = (await searchParams).isAdmin
  if (isAdmin === 'true') {
    // 취약: 신뢰할 수 없는 클라이언트 데이터에 의존합니다
    return <AdminPanel />
  }
}

// 좋음: 매번 다시 검증
import { cookies } from 'next/headers'
import { verifyAdmin } from './auth'

export default async function Page() {
  const cookieStore = await cookies()
  const token = cookieStore.get('AUTH_TOKEN')
  const isAdmin = await verifyAdmin(token)

  if (isAdmin) {
    return <AdminPanel />
  }
}
```

### 페이지의 검사는 그 안의 액션을 지켜주지 않습니다

페이지 수준의 `redirect`는 **어떤 UI가 렌더링되는지**를 제어합니다. 그 페이지 안에 정의된 Server Action은 자기 요청을 가진 별개의 진입점이며, 호출자를 스스로 검증해야 합니다.

```tsx filename="app/admin/page.tsx" highlight={13,14,15,16}
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function AdminPage() {
  const session = await auth()
  if (!session?.user?.isAdmin) {
    redirect('/login')
  }

  return (
    <form
      action={async () => {
        'use server'
        const session = await auth()
        if (!session?.user?.isAdmin) {
          throw new Error('Unauthorized')
        }
        await db.record.deleteMany()
      }}
    >
      <button>Delete Records</button>
    </form>
  )
}
```

### 인증은 인가가 아닙니다

"이 사용자가 로그인했는가?"와 "이 사용자가 *이* 레코드에 대해 작업해도 되는가?"는 다른 질문입니다. 두 번째를 빠뜨리면 [Insecure Direct Object Reference (IDOR)](https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html)이 됩니다 — 로그인한 사용자가 ID만 바꿔서 남의 게시글을 지우는 것입니다.

```tsx filename="app/actions.ts"
'use server'

import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

export async function deletePost(postId: string) {
  const session = await auth()
  if (!session?.user) {
    throw new Error('Unauthorized')
  }

  const post = await db.post.findUnique({ where: { id: postId } })

  // 사용자가 이 리소스의 소유자인지 확인합니다
  if (post.authorId !== session.user.id) {
    throw new Error('Forbidden')
  }

  await db.post.delete({ where: { id: postId } })
}
```

같은 DAL 패턴이 변경(mutation)에도 적용됩니다. 인증, 인가, 데이터베이스 접근을 `server-only` 모듈에 넣고 `'use server'` 파일은 얇게 유지하세요.

```ts filename="app/actions.ts"
'use server'

import { deletePost } from '@/data/posts'
import { revalidatePath } from 'next/cache'

export async function deletePostAction(postId: string) {
  await deletePost(postId) // 인증 + 인가는 DAL 안에서 일어납니다
  revalidatePath('/posts')
}
```

> **알아두면 좋은 점:** `import 'server-only'`는 DAL에서도 `"use server"` 파일 자체에서도 동작합니다. `useActionState`를 위해 액션을 Client Component로 import하더라도 마찬가지인데, `"use server"` 모듈은 서버 전용 번들러 레이어에서 해석되기 때문입니다.

### 반환값도 직렬화됩니다

액션이 반환하는 것은 무엇이든 네트워크를 타고 갑니다. ORM 호출 결과를 그대로 반환하면 잊고 있던 컬럼까지 전부 전송됩니다.

```tsx filename="app/actions.ts"
'use server'

// 나쁨: 내부 필드를 포함한 데이터베이스 레코드 전체를 반환합니다.
export async function updateUser(data: FormData) {
  const session = await auth()
  if (!session?.user) {
    throw new Error('Unauthorized')
  }
  return db.user.update({
    where: { id: session.user.id },
    data: { name: data.get('name') as string },
  })
}

// 좋음: 클라이언트에 필요한 것만 반환합니다.
export async function updateUserSafe(data: FormData) {
  const session = await auth()
  if (!session?.user) {
    throw new Error('Unauthorized')
  }
  await db.user.update({
    where: { id: session.user.id },
    data: { name: data.get('name') as string },
  })
  return { success: true }
}
```

비용이 큰 액션 — 메일 발송, 행 쓰기 — 에는 요청 수 제한(rate limiting)도 걸어야 합니다.

### 클로저는 클라이언트로 갔다가 돌아옵니다

컴포넌트 안에 액션을 정의하면 그 컴포넌트의 스코프를 클로저로 붙잡게 되는데, 렌더링 시점의 스냅샷을 포착하는 데 실제로 유용합니다.

```tsx filename="app/page.tsx" switcher
export default async function Page() {
  const publishVersion = await getLatestVersion();

  async function publish() {
    "use server";
    if (publishVersion !== await getLatestVersion()) {
      throw new Error('The version has changed since pressing publish');
    }
    ...
  }

  return (
    <form>
      <button formAction={publish}>Publish</button>
    </form>
  );
}
```

그 스냅샷이 액션 실행 시점까지 살아남으려면, 붙잡힌 변수들이 클라이언트로 갔다가 돌아와야 합니다. Next.js는 빌드마다 생성되는 개인 키로 이 값들을 **암호화**하므로, 액션은 자신을 만든 빌드에 대해서만 호출될 수 있습니다. 여기에 기대지는 마세요. 규칙은 여전히 "비밀 값을 클로저로 잡지 말 것"입니다.

서버 인스턴스를 여러 개 운영하면 각자 자기 키를 생성하므로, 한 인스턴스가 암호화한 액션을 다른 인스턴스가 복호화하지 못합니다 — 전형적인 *"Failed to find Server Action"* 에러입니다. 대신 키를 고정하세요.

```bash
openssl rand -base64 32
```

결과를 `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`로 설정합니다. 디코딩된 길이가 유효한 AES 키 크기(16, 24, 32바이트 — Next.js는 32바이트를 생성)인 base64 값이어야 합니다. 다른 키와 마찬가지로 교체와 서명을 관리하세요. 배포 쪽 이야기는 [NextJs_Docker_CI_CD.md](NextJs_Docker_CI_CD.md)에 있습니다.

### 허용 origin (CSRF)

액션은 `<form>`에서 호출될 수 있으므로 CSRF의 형태를 띱니다. 이미 두 가지 방어가 있습니다. 액션은 `POST`만 받고, Next.js는 `Origin` 헤더를 `Host`(또는 `X-Forwarded-Host`)와 비교해 불일치하면 요청을 중단합니다. SameSite 쿠키가 브라우저 기본값이므로 대부분의 경우는 이것으로 충분합니다.

리버스 프록시나 다층 백엔드 뒤에서는 운영 도메인과 서버가 인식하는 호스트가 정당하게 다를 수 있습니다. 검사를 끄지 말고 안전한 origin을 선언하세요.

```js filename="next.config.js"
/** @type {import('next').NextConfig} */
module.exports = {
  experimental: {
    serverActions: {
      allowedOrigins: ['my-proxy.com', '*.my-proxy.com'],
    },
  },
}
```

### 렌더링 중에는 절대 변경하지 마세요

사용자 로그아웃, 데이터베이스 쓰기, 캐시 무효화 — 어느 것도 렌더링 과정에 속하지 않습니다. Server Component든 Client Component든 마찬가지입니다. Next.js가 렌더링 중 쿠키 설정과 캐시 재검증을 막는 이유가 바로 이것입니다.

```tsx filename="app/page.tsx"
// 나쁨: 렌더링 중에 변경을 트리거
export default async function Page({ searchParams }) {
  if ((await searchParams).logout) {
    const cookieStore = await cookies()
    cookieStore.delete('AUTH_TOKEN')
  }

  return <UserProfile />
}
```

```tsx filename="app/page.tsx"
// 좋음: Server Action이 변경을 처리
import { logout } from './actions'

export default function Page() {
  return (
    <>
      <UserProfile />
      <form action={logout}>
        <button type="submit">Logout</button>
      </form>
    </>
  )
}
```

변경이 `POST`를 통해 일어난다는 사실은 GET 요청이 실수로 부수 효과를 내지 못하는 이유이기도 합니다.

## 환경 변수

두 가지 규칙이 대부분의 무게를 감당합니다.

1. 환경 변수는 **기본적으로 서버 전용**입니다. `NEXT_PUBLIC_` 접두사를 붙이면 `next build` 시점에 그 값이 클라이언트 번들에 인라인됩니다 — 이것은 설정이 아니라 공개입니다.
2. `.env*` 파일은 `.gitignore`에 들어가야 합니다. `create-next-app` 템플릿이 해주지만, 그래도 확인하세요.

`NEXT_PUBLIC_` 값은 빌드 시점에 인라인되므로 **산출물 안에 고정됩니다**. 하나의 Docker 이미지를 스테이징과 운영에 걸쳐 승격시켜도 이 값은 바뀌지 않습니다. 서버 측 변수에는 그런 문제가 없습니다. 동적 렌더링 중에 읽으면 요청마다 평가됩니다.

```tsx filename="app/page.ts" switcher
import { connection } from 'next/server'

export default async function Component() {
  await connection()
  // cookies, headers 등 Request 시점 API도 동적 렌더링을 선택하게 되며,
  // 그래서 이 환경 변수가 런타임 값이 됩니다
  const value = process.env.MY_VALUE
  // ...
}
```

또한 인라인되는 것은 리터럴 `process.env.NEXT_PUBLIC_X` 참조뿐입니다 — `process.env[varName]`은 인라인되지 않으며, 브라우저에서는 그냥 `undefined`가 됩니다.

## Content Security Policy

CSP는 스크립트, 스타일, 이미지, 폰트, 프레임 등을 어떤 origin이 공급할 수 있는지 브라우저에 알려줍니다. XSS, 클릭재킹을 비롯한 인젝션 공격에 대한 주된 방어이며, 배포 방식은 두 가지 — nonce를 쓰거나 쓰지 않거나 — 인데 비용 차이가 매우 큽니다.

### nonce 사용, proxy 경유

[nonce](https://developer.mozilla.org/docs/Web/HTML/Global_attributes/nonce)는 특정 인라인 스크립트를 허용 목록에 넣는 일회용 무작위 문자열입니다. 예측 불가능하고 **요청마다 새로워야** 하며, 그래서 nonce는 동적 렌더링을 요구합니다.

```ts filename="proxy.ts" switcher
import { NextRequest, NextResponse } from 'next/server'

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const isDev = process.env.NODE_ENV === 'development'
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''};
    style-src 'self' 'nonce-${nonce}';
    img-src 'self' blob: data:;
    font-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
`
  // 줄바꿈과 연속된 공백을 정리합니다
  const contentSecurityPolicyHeaderValue = cspHeader
    .replace(/\s{2,}/g, ' ')
    .trim()

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)

  requestHeaders.set(
    'Content-Security-Policy',
    contentSecurityPolicyHeaderValue
  )

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })
  response.headers.set(
    'Content-Security-Policy',
    contentSecurityPolicyHeaderValue
  )

  return response
}
```

> **알아두면 좋은 점:** `'unsafe-eval'`은 **개발 환경에서만** 필요합니다 — React가 서버 에러 스택을 브라우저에서 재구성하는 데 `eval`을 사용하기 때문입니다. 운영에서는 React도 Next.js도 기본적으로 `eval`을 쓰지 않습니다.

Proxy는 범위를 좁히지 않으면 모든 요청에서 실행됩니다. 이 헤더가 필요 없는 프리페치와 정적 자산은 건너뛰세요.

```ts filename="proxy.ts" switcher
export const config = {
  matcher: [
    /*
     * 다음으로 시작하는 경로를 제외한 모든 요청 경로와 매칭:
     * - api (API 라우트)
     * - _next/static (정적 파일)
     * - _next/image (이미지 최적화 파일)
     * - favicon.ico (파비콘 파일)
     */
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
```

nonce를 태그마다 직접 붙이지는 않습니다. Next.js가 요청의 `Content-Security-Policy` 헤더를 파싱해 `'nonce-{value}'` 패턴에서 값을 추출하고, 프레임워크 스크립트, 페이지 번들, Next.js가 생성한 인라인 스타일과 스크립트, 그리고 `<Script nonce={...}>`에 적용합니다. 서드파티 스크립트에 필요하다면 Server Component에서 읽으세요.

```tsx filename="app/page.tsx" switcher
import { headers } from 'next/headers'
import Script from 'next/script'

export default async function Page() {
  const nonce = (await headers()).get('x-nonce')

  return (
    <Script
      src="https://www.googletagmanager.com/gtag/js"
      strategy="afterInteractive"
      nonce={nonce}
    />
  )
}
```

반드시 동적이어야 하는 페이지는 `connection()`으로 강제할 수 있습니다.

```tsx filename="app/page.tsx" switcher
import { connection } from 'next/server'

export default async function Page() {
  // 이 페이지를 렌더링하기 위해 들어오는 요청을 기다립니다
  await connection()
  // 페이지 내용
}
```

### nonce의 대가

도입을 결정하기 전에 두 번 읽을 가치가 있는 부분입니다. nonce는 **모든 페이지를 동적으로 렌더링하게** 만들고, 그 여파가 이어집니다.

- 정적 최적화와 ISR이 비활성화됩니다
- 추가 작업 없이는 CDN이 페이지를 캐시할 수 없습니다
- **PPR과 호환되지 않습니다** — 정적 셸의 스크립트는 받을 nonce가 없습니다
- 첫 로드가 느려지고, 서버 부하와 호스팅 비용이 늘어납니다

페이지는 여전히 *빌드*됩니다. 동적 렌더링을 위한 설정이 없으면 런타임에 실패합니다. 무엇을 포기하는지는 [NextJs_Rendering.md](NextJs_Rendering.md)와 [NextJs_Caching.md](NextJs_Caching.md)를 참고하세요.

`'unsafe-inline'`을 금지하는 엄격한 요구사항이 있거나, 민감한 데이터를 다루거나, 일부 인라인 스크립트만 허용해야 하거나, 컴플라이언스가 엄격한 CSP를 요구할 때 이 거래를 받아들이세요.

### nonce 없이

그럴 필요가 없다면 `next.config.js`에서 헤더를 정적으로 설정하고 정적 페이지를 정적으로 유지하세요.

```js filename="next.config.js"
const isDev = process.env.NODE_ENV === 'development'

const cspHeader = `
    default-src 'self';
    script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''};
    style-src 'self' 'unsafe-inline';
    img-src 'self' blob: data:;
    font-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
`

module.exports = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: cspHeader.replace(/\n/g, ''),
          },
        ],
      },
    ]
  },
}
```

### Subresource Integrity (실험적)

SRI는 중간 지점입니다. JavaScript의 해시를 **빌드 시점**에 계산해 `integrity` 속성으로 내보내므로, 요청마다 nonce를 만들지 않고도 브라우저가 파일을 검증합니다.

```js filename="next.config.js"
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    sri: {
      algorithm: 'sha256', // 또는 'sha384', 'sha512'
    },
  },
}

module.exports = nextConfig
```

정적 생성, CDN 캐싱, 빌드 시점 무결성을 모두 유지할 수 있습니다. 한계는 실험적 기능이라는 점, App Router 전용이라는 점, 그리고 빌드 시점 전용이라 동적으로 생성되는 스크립트는 범위 밖이라는 점입니다. `v14.0.0`부터 사용할 수 있습니다.

### CSP가 무언가를 깨뜨릴 때

- **인라인 스타일** — nonce를 지원하는 CSS-in-JS 라이브러리를 쓰거나 스타일을 파일로 옮기세요
- **동적 import** — `script-src`가 허용하는지 확인하세요
- **WebAssembly** — `'wasm-unsafe-eval'`을 추가하세요
- **서비스 워커** — 별도의 정책을 주세요
- **서드파티 스크립트** — 도메인을 명시적으로 추가하세요. 예: `script-src ... https://www.googletagmanager.com; connect-src 'self' https://www.google-analytics.com;`

운영에서 흔한 실패는 해당 라우트를 포함하지 않는 proxy `matcher`와, Next.js 자체 정적 자산을 차단하는 정책입니다.

## 감사 체크리스트

Next.js 팀이 프로젝트를 검토할 때 가장 유심히 보라고 권하는 것들입니다.

- **Data Access Layer** — 존재하는가, 그리고 데이터베이스 패키지와 `process.env`가 정말로 그 바깥에 없는가?
- **`"use client"` 파일** — prop 타입이 비공개 데이터를 요구하는가? 시그니처가 지나치게 넓은가?
- **`"use server"` 파일** — 인자를 검증하는가? 액션 안에서 사용자를 다시 인가하는가? 로그인뿐 아니라 리소스 **소유권**을 확인하는가? 반환값을 걸러내는가? 데이터베이스 접근을 `server-only` DAL에 위임하는가?
- **`/[param]/` 폴더** — 대괄호는 사용자 입력을 뜻합니다. 검증하고 있는가?
- **`proxy.ts`와 `route.ts`** — 앱에서 가장 큰 권한을 가집니다. 전통적인 기법으로 감사하고, 모의 침투 테스트나 취약점 스캔을 정기적으로 수행하세요.

## 요약

App Router는 가장 중요한 한 가지 측면에서 기본적으로 안전합니다 — Server Component와 Client Component는 격리된 모듈 시스템에서 실행되므로, Client Component는 무엇을 import하든 데이터베이스나 `process.env`에 닿을 수 없습니다. 나머지는 모두 *여러분이* 그 선 너머로 건네는 데이터, 그리고 의도치 않게 만들어 내는 엔드포인트에 관한 문제입니다.

두 가지 습관이 대부분을 해결합니다. 첫째, 읽기와 쓰기를 인가를 수행한 뒤 DTO를 반환하는 `server-only` Data Access Layer로 모으세요 — 그러면 "클라이언트가 볼 수 있는 것은 무엇인가?"에 대한 답이 한 곳에 하나만 존재합니다. 둘째, 모든 Server Action을 공개 POST 엔드포인트로 취급하세요. 인증하고, 특정 리소스에 대해 인가하고, 인자를 검증하고, UI에 필요한 것만 반환하는 것입니다.

헤더 쪽에서는 CSP 문제를 비용으로 판단하세요. nonce는 엄격한 정책을 주는 대신 정적 렌더링, ISR, PPR을 앗아갑니다. `'unsafe-inline'`을 꼭 없애야 하는 것이 아니라면, `next.config.js`의 정적 정책 — 또는 실험적 SRI — 이 성능 손실 없이 보호의 대부분을 제공합니다.

## 더 읽을거리

* [Data Security](/docs/app/guides/data-security) — 이 노트가 요약한 가이드
* [Content Security Policy](/docs/app/guides/content-security-policy)
* [Environment Variables](/docs/app/guides/environment-variables)
* [Authentication](/docs/app/guides/authentication)
* [`taint`](/docs/app/api-reference/config/next-config-js/taint)
* [`serverActions.allowedOrigins`](/docs/app/api-reference/config/next-config-js/serverActions)
* [Security and Server Actions](https://nextjs.org/blog/security-nextjs-server-components-actions) — Next.js 팀의 정리 글
* [Strict CSP 예제](https://github.com/vercel/next.js/tree/canary/examples/with-strict-csp)
