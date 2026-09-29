# 배포

Next.js 앱은 Node.js 서버입니다. 나머지 — 컨테이너, 정적 호스트, 플랫폼 어댑터 — 는 모두 그 한 가지 사실의 변주이며, 문서는 이례적으로 단호합니다. Next.js를 실행하려면 플랫폼에 Node.js 서버가 필요하고, *그게 전부입니다*. 하나의 `next start` 프로세스가 Server Component, ISR, PPR, Cache Components, Server Actions, Proxy, `after()`를 모두 올바르게 처리합니다. 추가 인프라는 정확성이 아니라 성능과 다중 인스턴스 일관성을 사는 것입니다.

이 노트는 배포 대상을 고르는 법, 플랫폼이 지원해야 하는 것, 그리고 셀프 호스팅에 필요한 설정을 다룹니다. 컨테이너, 이미지 빌드, CI 파이프라인은 [NextJs_Docker_CI_CD.md](NextJs_Docker_CI_CD.md)에, 운영 전환의 보안 측면은 [NextJs_Security.md](NextJs_Security.md)에 있습니다.

## 네 가지 배포 대상

| 선택지 | 기능 지원 |
| --- | --- |
| **Node.js 서버** | 전부 |
| **Docker 컨테이너** | 전부 |
| **정적 export** | 제한적 |
| **어댑터** | 다양함 — [verified](#verified-어댑터) 어댑터는 테스트 스위트를 실행합니다 |

### Node.js 서버

Node.js를 실행하는 제공자면 어디든 됩니다. 필요한 것은 두 개의 스크립트뿐입니다.

```json filename="package.json"
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  }
}
```

`npm run build`가 빌드를 만들고, `npm run start`가 그것을 서빙합니다. 모든 Next.js 기능이 지원됩니다. HTTP 서버 자체를 직접 소유해야 한다면 [커스텀 서버](/docs/app/guides/custom-server)로 전환할 수 있지만, 그 과정에서 최적화를 잃게 됩니다 — 시작점이 아니라 최후의 수단입니다.

### 정적 export

`output: 'export'`를 설정하면 어떤 웹 서버로도 서빙할 수 있는 순수 HTML, CSS, JS가 만들어집니다 — S3, Nginx, Apache, GitHub Pages 등입니다. "정적 사이트로 시작해 나중에 서버로 올라간다"는 경로이며, [SPA](/docs/app/guides/single-page-applications) 방식의 토대이기도 합니다.

대가는 요청이 필요한 모든 것입니다. export에서 지원되지 않는 것들입니다.

- `dynamicParams: true`인 동적 라우트, 또는 `generateStaticParams()`가 없는 동적 라우트
- `Request`에 의존하는 Route Handler
- `cookies`
- `next.config.js`의 `rewrites`, `redirects`, `headers`
- Proxy
- Incremental Static Regeneration
- 기본 `loader`를 쓰는 이미지 최적화
- Draft Mode
- Server Actions
- Intercepting Routes

이 중 무엇이든 `next dev`에서 사용하면 루트 레이아웃에 `export const dynamic = 'error'`를 둔 것과 비슷하게 에러가 납니다. 이미지 최적화는 커스텀 로더로 여전히 *가능*하지만, 이미지는 빌드 중이 아니라 그 서비스에 의해 런타임에 최적화됩니다.

### 어댑터와 플랫폼

[Deployment Adapter API](/docs/app/api-reference/config/next-config-js/adapterPath)는 플랫폼이 Next.js 앱의 빌드와 배포 방식을 커스터마이즈할 수 있게 해줍니다. 어댑터는 빌드 시점에 실행되어 표준 빌드를 플랫폼 전용 출력으로 바꿉니다. API는 공개되어 있어 누구나 특별한 권한 없이 만들 수 있습니다.

#### Verified 어댑터

"verified"는 두 가지를 구체적으로 의미합니다. 어댑터가 **오픈 소스**일 것, 그리고 플랫폼이 전체 [호환성 테스트 스위트](/docs/app/api-reference/adapters/testing-adapters)를 그 어댑터에 대해 실행할 방법을 제공할 것. Verified 어댑터는 [Next.js GitHub 조직](https://github.com/nextjs) 아래에 있으며, Next.js 팀은 메이저 릴리스 전에 해당 플랫폼 팀과 테스트를 조율합니다.

현재 verified: **Vercel**과 **Bun**. Cloudflare와 Netlify는 같은 API 위에서 verified 어댑터를 만들고 있으며, 그 전까지는 자체 통합을 제공합니다.

다른 플랫폼 — Appwrite Sites, AWS Amplify Hosting, Cloudflare, Deno Deploy, Firebase App Hosting, Netlify — 은 공개 Adapter API 위에 만들어지지 *않은* 자체 Next.js 통합을 제공하며 verified가 아니므로 기능 지원 범위가 제각각입니다. 각 제공자의 문서를 확인하세요.

> **알아두면 좋은 점:** 플랫폼은 같은 공개 API와 테스트 스위트 위에 비공개 소스 어댑터를 만들 수도 있습니다. 다만 팀이 들여다볼 수 없는 것은 검증할 수 없으므로 verified로 등재되지 않을 뿐입니다.

## 플랫폼에 실제로 필요한 것

문서가 명시적으로 이름 붙인 두 개념을 구분하면 도움이 됩니다.

**기능적 충실도(functional fidelity)** — 모든 기능이 올바르게 동작하는 것. 이것은 이분법적입니다. 어댑터 테스트 스위트가 통과하거나 통과하지 않거나입니다. 기능적 충실도를 갖춘 플랫폼은 완전히 지원되는 배포 대상입니다.

**성능적 충실도(performance fidelity)** — 기능이 *최적의* 특성에 도달하는 것. PPR의 정적 셸이 오리진 지연이 아니라 CDN 지연으로 서빙되고, ISR이 1초 이내에 재검증을 전파하는 것 같은 경우입니다. 이것은 스펙트럼이며, 플랫폼이 차별화하는 지점입니다.

### 기능 지원 매트릭스

아래의 "Edge Stitching"은 성능 최적화이지 **정확성 요구사항이 아닙니다** — 모든 기능은 단일 오리진 서버에서도 올바르게 동작합니다.

| 기능 | 스트리밍 | 공유 캐시 | Edge Stitching | 비고 |
| --- | --- | --- | --- | --- |
| Server Components | 필수 | 아니오 | 아니오 | 기본 스트리밍 지원 |
| ISR (시간 기반) | 아니오 | 권장 | 아니오 | 공유 캐시 없이도 인스턴스별로 동작 |
| ISR (온디맨드) | 아니오 | 권장 | 아니오 | 다중 인스턴스에서 태그 전파에 공유 캐시 필요 |
| Partial Prerendering | 필수 | 권장 | 선택 | PPR 플랫폼 가이드 참고 |
| Cache Components (`use cache`) | 필수 | 권장 | 아니오 | 공유 캐시가 인스턴스 간 일관성을 가능하게 함 |
| Proxy / Middleware | 아니오 | 아니오 | 아니오 | 엣지 또는 오리진에서 실행 |
| Server Actions | 필수 | 아니오 | 아니오 | 스트리밍 응답을 동반한 POST 요청 |
| `after()` | 아니오 | 아니오 | 아니오 | 우아한 종료 지원 필요 |

**스트리밍 필수**란 chunked transfer encoding 또는 HTTP/2 스트리밍을 지원하고, 응답을 클라이언트에 보내기 전에 버퍼링하지 않는다는 뜻입니다. 없어도 동작은 합니다 — 응답이 통째로 조립되어 전송될 뿐이고, 스트리밍의 이점이 사라집니다.

**공유 캐시 권장**이란 여러 인스턴스가 공유 백엔드로부터 이득을 본다는 뜻입니다. 공유 캐시가 없으면 각 인스턴스가 자기 캐시를 유지합니다. 각 인스턴스에서는 올바르지만, 재검증 이벤트가 인스턴스 사이에 전파되지 않습니다. ISR과 서버 응답 캐싱에는 [`cacheHandler`](/docs/app/api-reference/config/next-config-js/incrementalCacheHandlerPath)를, `'use cache'` 항목에는 [`cacheHandlers`](/docs/app/api-reference/config/next-config-js/cacheHandlers)를 사용하세요.

Node.js 외에 유일하게 추가로 필요한 의존성은 이미지 최적화에 쓰이는 `sharp`입니다.

## 셀프 호스팅 설정

### 앞에 리버스 프록시를 두세요

Next.js 서버를 인터넷에 직접 노출하지 마세요. 앞단의 nginx 같은 것이 잘못된 형식의 요청, 느린 연결 공격, 페이로드 크기 제한, 요청 수 제한을 처리해 줍니다 — 그래야 Next.js 프로세스가 요청 검증이 아니라 렌더링에 자원을 씁니다.

### 이미지 최적화

`next/image`는 `next start` 아래에서 **설정 없이** 셀프 호스팅으로 동작합니다. 별도 서비스가 그 일을 하길 원한다면 [이미지 로더를 설정](/docs/app/api-reference/components/image#loader)하세요.

> **알아두면 좋은 점:** glibc 기반 리눅스에서는 과도한 메모리 사용을 막기 위해 이미지 최적화에 [추가 설정](https://sharp.pixelplumbing.com/install#linux-memory-allocator)이 필요할 수 있습니다.

### Proxy

[Proxy](/docs/app/api-reference/file-conventions/proxy) 역시 `next start` 아래에서 설정 없이 셀프 호스팅으로 동작합니다. 들어오는 요청이 필요하므로 정적 export에서는 사용할 수 없습니다.

그 계층에서 전체 Node.js API가 필요하다면, 로직을 레이아웃으로 옮겨 Server Component로 처리하는 것을 고려하세요 — `headers`를 확인하고 `redirect`를 호출하는 것은 거기서도 잘 됩니다. `next.config.js`의 `redirects`/`rewrites`에서 헤더, 쿠키, 쿼리 매칭을 쓰면 다른 여러 경우도 해결됩니다.

### 프록시를 통한 스트리밍

셀프 호스팅에서도 스트리밍은 지원되지만, 버퍼링하는 프록시가 조용히 무력화시킵니다. nginx라면 버퍼링을 끄세요.

```js filename="next.config.js"
module.exports = {
  async headers() {
    return [
      {
        source: '/:path*{/}?',
        headers: [
          {
            key: 'X-Accel-Buffering',
            value: 'no',
          },
        ],
      },
    ]
  },
}
```

nginx만이 아니라 경로 전체가 협조해야 합니다.

- **로드 밸런서**가 chunked transfer encoding이나 HTTP/2 스트리밍을 지원해야 합니다. 예컨대 Lambda 연동을 쓰는 AWS ALB 같은 일부 클라우드 로드 밸런서는 기본적으로 버퍼링합니다.
- 로드 밸런서와 Next.js 사이의 **리버스 프록시**도 chunked 응답을 그대로 통과시켜야 합니다.
- **PPR은 스트리밍을 요구합니다.** 없으면 정적 셸과 동적 콘텐츠가 전체 렌더링이 끝난 뒤 함께 도착하므로, PPR의 TTFB 이점이 통째로 사라집니다.

스트리밍이 무엇을 해주는지는 [NextJs_Rendering.md](NextJs_Rendering.md)를 참고하세요.

### 캐싱과 ISR

캐시된 응답, 생성된 정적 페이지, 빌드 출력, 정적 자산은 모두 **같은 Next.js 서버 캐시**에 살며, 기본적으로 각 인스턴스의 로컬 파일 시스템에 저장됩니다. 영속 디스크를 가진 단일 `next start` 인스턴스라면 이것이 자동으로 동작하고 따로 생각할 필요가 없습니다.

Next.js가 `Cache-Control`을 대신 설정해 주는데, CDN이 끼어 있을 때 이 기본값이 중요해집니다.

| 대상 | 헤더 |
| --- | --- |
| 진짜 불변인 자산(SHA 해시가 들어간 파일명) | `public, max-age=31536000, immutable` — 덮어쓸 수 없음 |
| ISR 페이지 | `s-maxage: <revalidate>, stale-while-revalidate` |
| 동적으로 렌더링된 페이지 | `private, no-cache, no-store, max-age=0, must-revalidate` |

동적 헤더는 Draft Mode를 포함해 사용자별 데이터가 캐시되는 것을 막아 줍니다. ISR 헤더가 조금이라도 도움이 되려면 CDN이 이 지시자와 캐시 키 가변성을 존중해야 합니다. 그렇지 않으면 응답이 CDN을 우회하거나, 클라이언트 측 내비게이션 중에 낡거나 어긋난 변형을 서빙하게 됩니다.

CDN이 앞에 있을 때, 동적 API를 건드리는 페이지는 `Cache-Control: private`을 받아 캐시 불가로 표시되고, 완전히 프리렌더된 페이지는 `public`을 받아 캐시될 수 있습니다. 둘을 섞을 필요가 없다면 라우트 전체를 정적으로 유지하고 CDN이 HTML을 보관하게 하세요.

### 커스텀 캐시 핸들러

일시적(ephemeral) 컴퓨트나, 각 파드가 자기 캐시 복사본을 가지는 쿠버네티스에서는 로컬 디스크 기본값이 서로 어긋난 낡은 콘텐츠를 만들어 냅니다. Next.js가 공유 저장소를 바라보게 하고 인메모리 계층을 끄세요.

```jsx filename="next.config.js"
module.exports = {
  cacheHandler: require.resolve('./cache-handler.js'),
  cacheMaxMemorySize: 0, // 기본 인메모리 캐싱 비활성화
}
```

```jsx filename="cache-handler.js"
const cache = new Map()

module.exports = class CacheHandler {
  constructor(options) {
    this.options = options
  }

  async get(key) {
    // 내구성 있는 저장소 등 어디에든 저장할 수 있습니다
    return cache.get(key)
  }

  async set(key, data, ctx) {
    // 내구성 있는 저장소 등 어디에든 저장할 수 있습니다
    cache.set(key, {
      value: data,
      lastModified: Date.now(),
      tags: ctx.tags,
    })
  }

  async revalidateTag(tags) {
    // tags는 문자열 또는 문자열 배열입니다
    tags = [tags].flat()
    // 캐시의 모든 항목을 순회합니다
    for (let [key, value] of cache) {
      // 값의 태그에 지정된 태그가 포함되어 있으면 이 항목을 삭제합니다
      if (value.tags.some((tag) => tags.includes(tag))) {
        cache.delete(key)
      }
    }
  }

  // 선택적인 요청 단위 인메모리 캐시로, 다음 요청 전에 초기화됩니다
  resetRequestCache() {}
}
```

위의 `Map`은 구현이 아니라 형태입니다. 운영에서는 내구성 있는 저장소(Redis, S3)로 뒷받침하고 축출 정책, 에러 처리, 분산 태그 조율을 추가하세요.

다중 인스턴스 배포에는 나머지 절반이 있습니다. `revalidateTag()`는 그것이 실행된 인스턴스만 무효화합니다. 핸들러에 [`refreshTags()`](/docs/app/api-reference/config/next-config-js/cacheHandlers#refreshtags)를 구현하세요 — 매 요청 전에 호출되며, 공유 저장소에서 태그 상태를 동기화해 모든 인스턴스가 무효화를 즉시 알게 해야 합니다.

> **알아두면 좋은 점:** `revalidatePath`는 캐시 태그 위의 편의 계층입니다 — 해당 페이지를 위한 특수 기본 태그로 `revalidateTag`를 호출합니다.

Cache Components는 셀프 호스팅에서 기본적으로 동작하며, `next start`와 Docker 컨테이너 모두 포함됩니다. CDN 전용 기능이 아닙니다. [NextJs_Caching.md](NextJs_Caching.md)를 참고하세요.

### 다른 도메인의 정적 자산

JS와 CSS를 CDN이나 별도 도메인에서 서빙하려면 [`assetPrefix`](/docs/app/api-reference/config/next-config-js/assetPrefix)를 설정하세요. Next.js가 그 파일들을 가져올 때 이 접두사를 사용합니다. 대가는 추가 DNS 조회와 TLS 핸드셰이크입니다.

### 우아한 종료

[`after()`](/docs/app/api-reference/functions/after)는 `next start` 아래에서 완전히 지원됩니다. 종료할 때는 `SIGINT`나 `SIGTERM`을 보내고 **기다리세요**. 서버가 진행 중인 요청을 끝내고 대기 중인 `after()` 콜백을 실행한 뒤 종료합니다. 플랫폼에 설정 가능한 드레인 기간을 주세요 — 권장은 10~30초 — 그렇지 않으면 백그라운드 작업이 도중에 죽습니다.

## 빌드 시점 환경 변수 대 런타임 환경 변수

배포에서 가장 많은 놀라움을 일으키는 구분입니다.

`NEXT_PUBLIC_` 변수는 **`next build` 중에 JavaScript 번들에 인라인됩니다**. 빌드가 끝난 뒤에는 앱이 그 변수의 변경에 더 이상 반응하지 않습니다. 하나의 산출물을 스테이징에서 운영으로 승격시켜도 모든 public 변수는 여전히 스테이징 값을 들고 있습니다. 브라우저가 정말로 런타임 값을 필요로 한다면, 대신 자체 API를 통해 제공하세요.

서버 측 변수에는 그런 제약이 없습니다. 동적 렌더링 중에 읽기만 한다면요.

```tsx filename="app/page.ts" switcher
import { connection } from 'next/server'

export default async function Component() {
  await connection()
  // cookies, headers 등 Request 시점 API도
  // 동적 렌더링을 선택하게 되며, 그래서
  // 이 환경 변수가 런타임에 평가됩니다
  const value = process.env.MY_VALUE
  // ...
}
```

그것이 하나의 이미지를 여러 환경에 승격시킬 수 있게 하는 것입니다. 조회 순서는 다음과 같고, 뒤로 갈수록 우선순위가 낮습니다.

1. `process.env`
2. `.env.$(NODE_ENV).local`
3. `.env.local` — `NODE_ENV`가 `test`일 때는 확인하지 않음
4. `.env.$(NODE_ENV)`
5. `.env`

`NODE_ENV`에 허용되는 값은 `production`, `development`, `test`뿐이며, Next.js는 `next dev`에는 `development`를, 그 외에는 `production`을 부여합니다. `/src` 디렉터리를 쓰더라도 `.env.*` 파일은 프로젝트 루트에 있어야 합니다. 서버 시작 시 실행해야 하는 코드는 [`register` 함수](/docs/app/guides/instrumentation)에 둡니다.

## 운영 체크리스트

배포 전에 로컬에서 `next build`를 실행해 빌드 에러를 잡고, `next start`로 운영과 비슷한 환경에서 성능을 측정하세요.

**설정 없이 이미 처리되는 것:** Server Component가 코드를 클라이언트 번들 밖에 두고, 코드 분할이 라우트 세그먼트 단위로 일어나며, `<Link>`가 뷰포트에 들어온 라우트를 프리페치하고, 가능한 경우 Server/Client Component가 빌드 시점에 프리렌더되며, 데이터 요청·렌더링 결과·정적 자산이 캐시됩니다.

**배포 전에 확인할 것:**

| 영역 | 확인 사항 |
| --- | --- |
| 렌더링 | Request 시점 API(`cookies`, `searchParams`)는 라우트 전체를 — 루트 레이아웃에서 쓰면 앱 *전체*를 — 동적 렌더링으로 전환시킵니다. 의도한 것이고 `<Suspense>`로 감쌌는가? |
| 에러 | 커스텀 `not-found`, 그리고 앱 전역의 접근 가능한 폴백을 위한 `app/global-error.tsx`와 `app/global-not-found.tsx` |
| 데이터 | 워터폴 대신 병렬 페칭, `fetch`가 아닌 요청도 필요하면 캐싱, Server Component에서 Route Handler를 호출하지 않기 |
| 자산 | 폰트는 Font Module, 이미지는 `<Image>`, 서드파티 스크립트는 `<Script>`, 정적 파일은 `public/` |
| 보안 | `.env*`를 `.gitignore`에, public 변수만 `NEXT_PUBLIC_` 접두사, 모든 Server Action 안에서 인증 재확인, CSP 검토 — [NextJs_Security.md](NextJs_Security.md) 참고 |
| SEO | 메타데이터, OG 이미지, 사이트맵, robots — [NextJs_SEO.md](NextJs_SEO.md) 참고 |
| 타입 | TypeScript와 TS 플러그인 |
| 접근성 | 내장 `eslint-plugin-jsx-a11y` |
| 측정 | 시크릿 모드에서 Lighthouse, 필드 데이터를 위한 `useReportWebVitals`, 번들 크기를 위한 `@next/bundle-analyzer` — [NextJs_Performance.md](NextJs_Performance.md) 참고 |

## 요약

배포 결정은 하나의 질문으로 수렴합니다. 이 앱은 런타임에 요청이 필요한가? 필요하다면 Node.js 서버가 필요하고, 모든 것이 동작합니다. 필요 없다면 `output: 'export'`가 어디에나 올려둘 수 있는 정적 파일을 줍니다 — 쿠키, Proxy, Server Actions, ISR, 기본 이미지 로더를 대가로 치르고서요.

셀프 호스팅에서 의도적인 설정이 필요한 것은 네 가지이고 나머지는 기본값입니다. 앞단의 리버스 프록시, 스트리밍이 살아남도록 경로 전체에서 버퍼링 끄기, 인스턴스가 둘 이상이면 공유 캐시 핸들러, 그리고 `after()` 콜백이 끝날 수 있도록 종료 시 드레인 기간.

몸에 익혀야 할 함정은 `NEXT_PUBLIC_`입니다. 이 값들은 빌드 시점에 번들에 구워지므로, 하나의 산출물이 환경마다 다른 값을 들고 다닐 수 없습니다. 동적 렌더링 중에 읽는 서버 측 변수는 살아 있습니다 — 그것이 바로 한 번 빌드해 어디에나 배포하는 것을 가능하게 합니다.

## 더 읽을거리

* [Deploying](/docs/app/getting-started/deploying) — 네 가지 배포 대상
* [Deploying to Platforms](/docs/app/guides/deploying-to-platforms) — 기능/인프라 매트릭스
* [Self-Hosting](/docs/app/guides/self-hosting) — 이 노트의 대부분이 요약한 가이드
* [Production Checklist](/docs/app/guides/production-checklist)
* [Static Exports](/docs/app/guides/static-exports)
* [Environment Variables](/docs/app/guides/environment-variables)
* [CDN Caching](/docs/app/guides/cdn-caching)
* [PPR Platform Guide](/docs/app/guides/ppr-platform-guide)
* [Self-hosting Next.js](https://www.youtube.com/watch?v=sIVL4JMqRfc) — Next.js 팀의 45분 강연
