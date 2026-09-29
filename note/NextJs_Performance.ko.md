# 성능 (Performance)

App Router에서의 성능 작업은 두 부분으로 나뉩니다. 첫 번째는 **프레임워크가 이미 해주는 것**입니다. Server Components, 코드 분할, 프리페칭, 프리렌더링, 캐싱은 기본으로 켜져 있고 별도 설정이 필요 없습니다. 두 번째는 **오직 개발자만 할 수 있는 것**입니다. 이미지·폰트·서드파티 스크립트가 페이지에 들어오는 방식, 브라우저까지 전달되는 JavaScript의 양, 그리고 그 결과를 측정하는 방법입니다.

이 노트는 두 번째 부분을 다룹니다. 성능의 렌더링 측면 — 스트리밍, Suspense 경계, 정적 셸, 그리고 그것들이 각 Web Vital에 미치는 영향 — 은 [NextJs_Rendering.md](NextJs_Rendering.md)에 있고, 캐싱과 프리페칭은 [NextJs_Caching.md](NextJs_Caching.md)에 있습니다. 여기서 반복하지 않습니다.

## 기본으로 주어지는 것

| 최적화 | 하는 일 |
| --- | --- |
| **Server Components** | 기본값입니다. 서버에서 실행되며 클라이언트 번들에 **전혀** 기여하지 않습니다. |
| **코드 분할** | 라우트 세그먼트 단위로 자동 적용됩니다. 현재 라우트에 필요한 코드만 로드됩니다. |
| **프리페칭** | `<Link>`가 뷰포트에 들어오면 해당 라우트를 백그라운드에서 가져옵니다. |
| **프리렌더링** | 가능한 경우 Server/Client Components를 빌드 시점에 렌더링하고 그 결과를 캐시합니다. |
| **캐싱** | 데이터 요청, 렌더링 결과, 정적 자산을 캐시해 네트워크 왕복을 줄입니다. |

아래 내용은 모두 이 기본값이 다루지 못하는 경우에 관한 것입니다.

## 이미지

`next/image`는 `<img>`에 네 가지를 더합니다. **크기 최적화**(최신 포맷으로 알맞은 크기의 이미지 제공), **시각적 안정성**(공간을 미리 확보해 밀림이 없음), **지연 로딩**(네이티브 방식, 선택적으로 블러 플레이스홀더 사용), 그리고 **온디맨드 리사이징** — 원격 서버의 이미지까지 포함합니다.

```tsx filename="app/page.tsx"
import Image from 'next/image'

export default function Page() {
  return <Image src="/profile.png" alt="Picture of the author" width={500} height={500} />
}
```

### `src`의 세 가지 형태

**정적 import** — 가장 좋은 경우입니다. Next.js가 빌드 시점에 파일을 읽어 `width`, `height`, `blurDataURL`을 대신 채워 줍니다.

```tsx
import ProfileImage from './profile.png'

<Image
  src={ProfileImage}
  alt="Picture of the author"
  // width, height, blurDataURL이 자동으로 제공됩니다
  placeholder="blur" // 로딩 중 블러 처리(선택)
/>
```

**경로 문자열** — `public/` 아래의 파일을 기본 URL(`/profile.png`)로 참조합니다. `width`와 `height`를 직접 전달해야 합니다.

**원격 URL** — `width`와 `height`를 직접 전달해야 하고(블러 플레이스홀더를 원한다면 `blurDataURL`도), Next.js가 빌드 시점에 파일에 접근할 수 없기 때문입니다. 또한 `next.config.ts`에서 호스트를 허용해야 하며, 가능한 한 구체적으로 지정해야 합니다.

```ts filename="next.config.ts"
import type { NextConfig } from 'next'

const config: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 's3.amazonaws.com',
        port: '',
        pathname: '/my-bucket/**',
        search: '',
      },
    ],
  },
}

export default config
```

이것은 편의 기능이 아니라 보안 경계입니다. 패턴이 느슨하면 이미지 최적화 기능이 임의의 원격 이미지를 위한 열린 프록시가 됩니다.

### 정적으로 import할 수 없는 이미지

파일명이 런타임에만 정해진다면, Server Component 안에서 **동적 `import()`** 를 써도 자동 크기와 블러 데이터를 얻을 수 있습니다.

```tsx filename="app/blog/[slug]/page.tsx"
async function PostImage({ imageFilename, alt }: { imageFilename: string; alt: string }) {
  const { default: image } = await import(`../content/blog/images/${imageFilename}`)
  // image에 width, height, blurDataURL이 포함됩니다
  return <Image src={image} alt={alt} />
}
```

경로에는 **정적 접두사**(`../content/blog/images/`)가 반드시 포함되어야 합니다. 그 접두사에 일치하는 모든 파일이 번들에 들어가므로 범위를 좁게 유지하세요. 접두사가 고정되어 있기 때문에 외부 입력이 디렉터리 밖으로 벗어날 수 없습니다.

### 알아 둘 props

| Prop | 기본값 | 설명 |
| --- | --- | --- |
| `alt` | — | 필수입니다. 순수하게 장식용인 이미지에는 `alt=""`를 사용하세요. |
| `width` / `height` | — | 픽셀 단위의 고유 크기로, 종횡비를 미리 확보하는 데 쓰입니다. 정적 import이거나 `fill`을 쓰는 경우가 아니면 필수입니다. **렌더링되는 크기를 정하지 않습니다** — 그것은 CSS의 몫입니다. |
| `fill` | `false` | 이미지가 부모 요소를 채우도록 확장됩니다. 크기를 알 수 없을 때 사용합니다. |
| `sizes` | — | 아래 참고. |
| `quality` | `75` | 1–100. 값이 클수록 용량이 크고 선명합니다. |
| `preload` | `false` | `<head>`에 `<link rel="preload">`를 삽입합니다. LCP 이미지에만 사용합니다. |
| `loading` | `lazy` | `eager`는 위치와 무관하게 즉시 로드합니다. |
| `placeholder` | `empty` | `blur`(`blurDataURL` 필요) 또는 `data:image/...` URL. |
| `unoptimized` | `false` | 최적화를 건너뜁니다. 원본이 인증 헤더를 요구할 때 필요합니다(최적화 API는 헤더를 전달하지 않습니다). |

> **폐기 예정:** Next.js 16부터 `priority`는 [`preload`](/docs/app/api-reference/components/image#preload)로 대체되며 폐기되었습니다. 새 이름이 실제 동작을 더 정확히 나타냅니다.

### `sizes`가 없으면 비용이 드는 이유

`sizes`는 각 브레이크포인트에서 이미지가 얼마나 넓게 표시될지를 브라우저에 알려 주어, `srcset`에서 알맞은 항목을 고르게 합니다.

```tsx
<Image fill src="/example.png" sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" />
```

이미지가 `fill`을 쓰거나 CSS로 반응형이 되는 경우에는 항상 사용하세요. **`sizes`가 없으면 브라우저는 이미지가 뷰포트만큼 넓다고(`100vw`) 가정하고** 필요한 것보다 훨씬 큰 파일을 내려받습니다.

`sizes`는 Next.js가 생성하는 결과도 바꿉니다.

* **`sizes` 없음** — 제한된 `srcset`(1x, 2x). 고정 크기 이미지에 적합합니다.
* **`sizes` 있음** — 전체 `srcset`(640w, 750w, …). 반응형 레이아웃에 적합합니다.

### LCP 이미지 미리 로드하기

`preload`는 브라우저가 본문에서 `<img>` 태그를 발견하기 전에 `<head>`에서부터 이미지를 가져오기 시작합니다. 이미지가 [Largest Contentful Paint](https://web.dev/lcp/) 요소일 때 — 보통 첫 화면의 히어로 이미지 — 사용하세요.

뷰포트에 따라 LCP 요소가 될 수 있는 이미지가 여러 개일 때, 또는 `loading`·`fetchPriority`와 함께 쓸 때는 사용하지 마세요. 그 외 대부분의 경우에는 `loading="eager"`나 `fetchPriority="high"`가 더 적절한 도구입니다.

### 출력 포맷

```js filename="next.config.js"
module.exports = {
  images: {
    formats: ['image/webp'], // 기본값
  },
}
```

Next.js는 요청의 `Accept` 헤더를 읽고, 브라우저가 지원하는 포맷 중 설정 배열에서 **먼저 일치하는** 것을 고릅니다. 즉 **배열 순서가 중요합니다.** AVIF는 WebP보다 약 20% 더 작게 압축되지만 인코딩에 약 50% 더 오래 걸립니다. 따라서 이미지의 첫 요청은 더 느리고, 포맷별로 따로 캐시됩니다. 대부분의 사이트에는 여전히 WebP를 권장합니다.

> CDN이나 프록시 뒤에서 자체 호스팅한다면 그 앞단이 `Accept` 헤더를 **반드시** 전달해야 하며, 그렇지 않으면 포맷 협상이 깨집니다.

`minimumCacheTTL`(기본 4시간)은 최적화된 이미지가 캐시되는 시간을 정합니다. 캐시를 무효화하는 방법이 없으므로, `src`를 바꾸거나 `<distDir>/cache/images`를 직접 지울 각오가 아니라면 값을 낮게 유지하세요. 정적 import는 이 문제를 아예 피해 갑니다. 파일명이 내용 해시로 만들어지고 `immutable`로 캐시되기 때문입니다.

## 폰트

`next/font`는 Google Fonts를 포함해 **모든 폰트 파일을 자체 호스팅**합니다. 파일이 내 도메인에서 제공되므로 브라우저가 Google에 접속하지 않고, 메트릭이 맞춰진 대체 폰트와 함께 미리 로드되므로 레이아웃 밀림이 없습니다.

이 프로젝트는 이미 [app/layout.tsx](app/layout.tsx)에서 CSS 변수 방식을 사용하고 있습니다.

```tsx filename="app/layout.tsx"
import { Geist, Geist_Mono } from 'next/font/google'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  )
}
```

더 간단한 방식은 `className={geist.className}`으로 폰트를 직접 적용하는 것입니다. `variable` 방식은 대신 CSS 사용자 정의 속성을 선언하는데, 스타일시트나 Tailwind 설정에서 그 폰트 패밀리를 참조해야 할 때 필요한 방식입니다.

**가변 폰트를 우선하세요.** 가변 폰트가 아니라면 `weight`가 필수가 됩니다.

```tsx
const roboto = Roboto({ weight: '400', subsets: ['latin'] })
```

### 로컬 폰트

```tsx
import localFont from 'next/font/local'

const myFont = localFont({ src: './my-font.woff2' })
```

경로는 `localFont`를 호출한 파일을 기준으로 해석됩니다. 한 패밀리에 여러 파일이 있다면 배열을 전달합니다.

```js
const roboto = localFont({
  src: [
    { path: './Roboto-Regular.woff2', weight: '400', style: 'normal' },
    { path: './Roboto-Italic.woff2', weight: '400', style: 'italic' },
    { path: './Roboto-Bold.woff2', weight: '700', style: 'normal' },
  ],
})
```

### 옵션

| 옵션 | 기본값 | 적용 대상 | 설명 |
| --- | --- | --- | --- |
| `subsets` | — | google | 미리 로드할 서브셋, 예: `['latin']`. 여기에 지정한 것에 대해서만 preload 태그가 삽입됩니다. |
| `weight` | — | 둘 다 | 가변 폰트가 아니면 필수. 가변 폰트는 범위(`'100 900'`)로 지정합니다. |
| `display` | `'swap'` | 둘 다 | 표준 `font-display` 값들. |
| `preload` | `true` | 둘 다 | `<link rel="preload">`를 삽입합니다. |
| `fallback` | — | 둘 다 | 예: `['system-ui', 'arial']`. |
| `adjustFontFallback` | `true` / `'Arial'` | 둘 다 | CLS를 줄이기 위해 메트릭이 맞춰진 대체 폰트를 생성합니다. `false`로 끌 수 있습니다. |
| `variable` | — | 둘 다 | 선언할 CSS 변수 이름. |
| `axes` | — | google | weight 외의 추가 가변 축. 축마다 파일 크기가 늘어납니다. |

### 폰트가 미리 로드되는 범위

어딘가에서 import했다고 해서 폰트가 **전역**이 되지는 않습니다. 그 폰트를 사용하는 라우트에서만 미리 로드됩니다.

* **페이지**에서 호출 → 그 라우트에서만 미리 로드.
* **레이아웃**에서 호출 → 그 레이아웃이 감싸는 모든 라우트에서 미리 로드.
* **루트 레이아웃**에서 호출 → 모든 라우트에서 미리 로드.

## 서드파티 스크립트

`next/script`는 서드파티 스크립트를 지연시켜 메인 스레드를 막지 않게 하고, 해당 스크립트를 선언한 레이아웃을 공유하는 라우트 사이를 이동하더라도 스크립트가 **한 번만 로드**되도록 보장합니다.

```tsx filename="app/dashboard/layout.tsx"
import Script from 'next/script'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <section>{children}</section>
      <Script src="https://example.com/script.js" />
    </>
  )
}
```

스크립트는 그것이 필요한 가장 좁은 레이아웃에 두세요. 루트 레이아웃에 둔 스크립트는 애플리케이션의 모든 라우트에서 실행됩니다.

### 전략(strategy)

| `strategy` | 로드 시점 | 용도 |
| --- | --- | --- |
| `beforeInteractive` | 서버 HTML에 주입되고, Next.js 코드보다 먼저 가져옵니다. 반드시 **루트 레이아웃**에 있어야 합니다. | 정말로 중요한 스크립트만 — 봇 탐지, 동의 관리 등. |
| `afterInteractive` | **기본값.** 클라이언트 측에서, 일부 하이드레이션 이후에 로드합니다. | 태그 매니저, 애널리틱스. |
| `lazyOnload` | 다른 모든 것이 로드된 후 브라우저 유휴 시간에 로드합니다. | 채팅 위젯, 소셜 임베드. |
| `worker` | Partytown을 통해 웹 워커에서 실행합니다. **실험적이며 App Router에서는 동작하지 않습니다.** | — |

`beforeInteractive`는 자사 코드보다 먼저 preload되지만, 그 실행이 하이드레이션을 막지는 않습니다.

### 인라인 스크립트와 핸들러

인라인 스크립트에는 Next.js가 추적하고 최적화할 수 있도록 `id`가 **반드시** 있어야 합니다.

```jsx
<Script id="show-banner">
  {`document.getElementById('banner').classList.remove('hidden')`}
</Script>
```

`onLoad`, `onReady`, `onError`는 Client Component 안에서만 동작합니다. 그 외에 전달한 DOM 속성(`nonce`, `data-*`)은 최종 `<script>` 태그로 그대로 전달됩니다.

> **JSON-LD**에는 `next/script`가 아니라 일반 `<script type="application/ld+json">`을 사용하세요. 구조화된 데이터는 실행 가능한 코드가 아닙니다. [NextJs_SEO.md](NextJs_SEO.md)를 참고하세요.

## 클라이언트 JavaScript 지연 로딩

Server Components는 이미 코드 분할되어 있고, 스트리밍은 이미 UI를 점진적으로 전달합니다. **지연 로딩은 Client Components와 그것들이 import하는 라이브러리에 관한 것**입니다. 초기 번들에 들어가지 않도록 미루는 것이죠.

`next/dynamic`은 `React.lazy()`와 Suspense를 한 번에 호출하는 것과 같습니다.

```jsx filename="app/page.js"
'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'

const ComponentA = dynamic(() => import('../components/A'))
const ComponentB = dynamic(() => import('../components/B'))
const ComponentC = dynamic(() => import('../components/C'), { ssr: false })

export default function Example() {
  const [showMore, setShowMore] = useState(false)

  return (
    <div>
      {/* 즉시 로드되지만 별도의 클라이언트 번들로 분리됩니다 */}
      <ComponentA />

      {/* 조건이 충족될 때만 필요에 따라 로드됩니다 */}
      {showMore && <ComponentB />}
      <button onClick={() => setShowMore(!showMore)}>Toggle</button>

      {/* 클라이언트에서만 로드됩니다 */}
      <ComponentC />
    </div>
  )
}
```

`loading`으로 폴백을 지정합니다.

```jsx
const WithCustomLoading = dynamic(() => import('../components/WithCustomLoading'), {
  loading: () => <p>Loading...</p>,
})
```

이름 붙은 export는 promise에서 꺼냅니다.

```jsx
const ClientComponent = dynamic(() => import('../components/hello').then((mod) => mod.Hello))
```

**기억해 둘 제약:**

* `ssr: false`는 **Client Component에서만** 동작합니다. Server Component에서 쓰면 오류입니다.
* *Server* Component가 *Client* Component를 동적으로 import할 때, 자동 코드 분할은 현재 **지원되지 않습니다.**
* Server Component를 동적으로 import하면 그 하위의 Client Components가 지연 로딩되며, Server Component 자체는 아닙니다.

### 필요할 때만 라이브러리 로드

한 번의 상호작용에만 쓰이는 무거운 라이브러리는 아예 번들에 있을 필요가 없습니다.

```jsx
onChange={async (e) => {
  const { value } = e.currentTarget
  const Fuse = (await import('fuse.js')).default
  setResults(new Fuse(names).search(value))
}}
```

### 매직 코멘트

동적 `import()`, `require()`, `require.resolve()`, `new Worker()`에서 동작하며 — 정적 `import` 문에서는 **동작하지 않습니다.**

```js
// import를 출력물에 그대로 남기고 런타임에 해석합니다
const runtime = await import(/* webpackIgnore: true */ 'runtime-module')
const plugin = await import(/* turbopackIgnore: true */ pluginPath)

// Turbopack 전용: 모듈이 없어도 빌드 오류가 나지 않습니다
const feature = await import(/* turbopackOptional: true */ './optional-feature')
```

`webpackOptional`은 존재하지 않습니다. Turbopack에서는 `turbopackOptional`을 사용하세요.

## 큰 번들 찾아서 줄이기

번들이 작을수록 더 빨리 로드되고, 실행할 JavaScript가 줄고, Core Web Vitals가 좋아지며, 서버 콜드 스타트가 짧아집니다.

### 측정

**Turbopack 분석기**(v16.1+, 실험적) — 모듈 그래프와 통합되어 있어 모듈의 전체 import 체인을 추적하고 누가 그것을 끌어왔는지 정확히 볼 수 있습니다.

```bash
npx next experimental-analyze
npx next experimental-analyze --output   # 비교용으로 .next/diagnostics/analyze에 기록
```

**Webpack 분석기** — `@next/bundle-analyzer`:

```js filename="next.config.js"
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

module.exports = withBundleAnalyzer({})
```

```bash
ANALYZE=true npm run build
```

### export가 수백 개인 패키지

아이콘·유틸리티 라이브러리는 수천 개의 모듈을 export하기도 합니다. `optimizePackageImports`는 실제로 사용하는 것만 로드합니다.

```js filename="next.config.js"
module.exports = {
  experimental: {
    optimizePackageImports: ['icon-library'],
  },
}
```

흔히 쓰는 상당수 패키지는 이미 기본으로 최적화되어 있어 따로 등록할 필요가 없습니다 — `lucide-react`, `date-fns`, `lodash-es`, `ramda`, `antd`, `@mui/material`, `@mui/icons-material`, `recharts`, `rxjs`, `@headlessui/react`, `@heroicons/react/*`, `@tabler/icons-react`, `react-icons/*`, `effect` 등.

### 무거운 작업이 잘못된 곳에 있는 경우

클라이언트 번들이 커지는 가장 흔한 원인은, 결과물이 마크업뿐인 작업을 Client Component에서 하는 것입니다. 구문 강조, 차트 렌더링, 마크다운 파싱 같은 것들이죠. 브라우저 API도 상호작용도 필요 없다면 그 작업은 서버에 속합니다.

```tsx filename="app/blog/[slug]/page.tsx"
// prism 토크나이저 전체가 <code> 블록 하나를 그리려고 브라우저로 전송됩니다
'use client'
import Highlight from 'prism-react-renderer'
```

```tsx filename="app/blog/[slug]/page.tsx"
// 더 나은 방법: shiki가 서버에서 실행되고, 클라이언트는 순수 마크업만 받습니다
import { codeToHtml } from 'shiki'

export default async function Page() {
  const highlightedHtml = await codeToHtml(code, { lang: 'tsx', theme: 'github-dark' })
  return <pre><code dangerouslySetInnerHTML={{ __html: highlightedHtml }} /></pre>
}
```

### 서버 번들링

Server Components와 Route Handlers에서 import한 패키지는 자동으로 번들됩니다. 번들링을 견디지 못하는 패키지 — 네이티브 애드온, 자기 자신을 기준으로 파일을 읽는 패키지 — 는 제외하세요.

```js filename="next.config.js"
module.exports = {
  serverExternalPackages: ['package-name'],
}
```

### 의존성을 추가하기 전에

[Import Cost](https://marketplace.visualstudio.com/items?itemName=wix.vscode-import-cost) · [Package Phobia](https://packagephobia.com/) · [Bundle Phobia](https://bundlephobia.com/) · [bundlejs](https://bundlejs.com/)

## 결과 측정하기

### Web Vitals

| 지표 | 측정 대상 |
| --- | --- |
| **TTFB** | 첫 바이트까지의 시간. |
| **FCP** | 첫 콘텐츠가 그려지는 시점. |
| **LCP** | 가장 큰 콘텐츠가 그려지는 시점 — 주요 콘텐츠. |
| **CLS** | 누적 레이아웃 이동 — 시각적 안정성. |
| **INP** | 상호작용부터 다음 페인트까지 — 반응성. |
| **FID** | 첫 입력 지연(INP로 대체됨). |

스트리밍과 Suspense 배치가 각 지표에 어떤 영향을 주는지는 [NextJs_Rendering.md](NextJs_Rendering.md)의 "Rendering and Web Vitals"에서 다룹니다.

### 직접 보고하기

`useReportWebVitals`는 `'use client'`가 필요하므로, 별도 컴포넌트로 만들고 루트 레이아웃에서 그것을 import하세요. 그러면 클라이언트 경계가 아무것도 렌더링하지 않는 컴포넌트 하나로 한정됩니다.

```jsx filename="app/_components/web-vitals.js"
'use client'

import { useReportWebVitals } from 'next/web-vitals'

export function WebVitals() {
  useReportWebVitals((metric) => {
    console.log(metric)
  })
}
```

```jsx filename="app/layout.js"
import { WebVitals } from './_components/web-vitals'

export default function Layout({ children }) {
  return (
    <html>
      <body>
        <WebVitals />
        {children}
      </body>
    </html>
  )
}
```

결과는 어디로든 보낼 수 있습니다. 페이지가 언로드되어도 요청이 살아남도록 `sendBeacon`을 우선 사용하세요.

```js
useReportWebVitals((metric) => {
  const body = JSON.stringify(metric)
  const url = 'https://example.com/analytics'

  if (navigator.sendBeacon) {
    navigator.sendBeacon(url, body)
  } else {
    fetch(url, { body, method: 'POST', keepalive: true })
  }
})
```

`metric.id`는 페이지 로드마다 고유하며, 이 값이 있어야 원시 이벤트로부터 백분위 분포를 다시 구성할 수 있습니다.

### 클라이언트 계측(instrumentation)

프로젝트 루트의 `instrumentation-client.ts` 파일은 프런트엔드 코드보다 **먼저** 실행됩니다. 애널리틱스나 오류 추적을 초기화하기에 알맞은 자리입니다.

```js filename="instrumentation-client.js"
console.log('Analytics initialized')

window.addEventListener('error', (event) => {
  reportError(event.error)
})
```

### 실험실 데이터와 현장 데이터

반복 가능한 실험실 측정을 위해 시크릿 창에서 [Lighthouse](https://developers.google.com/web/tools/lighthouse)를 실행하되, 그것은 시뮬레이션임을 기억하세요. 실제 사용자로부터 오는 현장 데이터와 함께 봐야 하며, 그 데이터를 주는 것이 `useReportWebVitals`입니다. 무엇을 측정하든 먼저 `next build`와 `next start`를 실행하세요. `next dev`는 대표성이 없습니다.

## 프로덕션 체크리스트

[production checklist](/docs/app/guides/production-checklist)를 요약한 것입니다. 다른 노트에서 이미 다룬 항목은 반복하지 않고 링크했습니다.

* **`"use client"` 경계를 점검하세요.** 경계 하나가 곧 번들 하나입니다. 상호작용이 필요한 말단까지 밀어 내리세요.
* **요청 시점 API는 렌더링에 관한 결정입니다.** `cookies()`, `headers()`, `searchParams`는 라우트를 동적 렌더링으로 전환시킵니다 — 루트 레이아웃에서 쓰면 앱 전체가 그렇게 됩니다. `<Suspense>`로 감싸세요. [NextJs_Rendering.md](NextJs_Rendering.md)를 참고하세요.
* **병렬로 페치해** 워터폴을 피하고, 실제로 무엇이 캐시되는지 확인하세요. [NextJs_Fetching_Data.md](NextJs_Fetching_Data.md)와 [NextJs_Caching.md](NextJs_Caching.md)를 참고하세요.
* **Server Component에서 Route Handler를 호출하지 마세요** — 불필요한 네트워크 왕복이 추가됩니다.
* **`<Link>`를 사용해** 프리페칭이 동작하게 하세요.
* 원시 태그 대신 **`next/image`, `next/font`, `next/script`를 사용하세요.**
* **정적 자산은 `public/`에서 제공해** 자동으로 캐시되게 하세요.
* **`eslint-plugin-jsx-a11y`를 켜 두어** 접근성 문제를 일찍 잡으세요.
* **`error.tsx`와 `not-found.tsx`를 추가해** 실패 시 페이지가 비는 대신 우아하게 저하되도록 하세요.

## 요약

프레임워크는 구조적인 최적화를 맡습니다. 코드를 분할하고, 라우트를 프리페치하고, 가능한 것을 프리렌더링하고, 나머지를 캐시하죠. 개발자에게 남는 것은 브라우저라는 경계를 넘어가는 모든 것입니다.

세 가지 질문이 대부분을 덮습니다. **LCP 요소는 무엇이며, 일찍 발견되는가?** 히어로 이미지의 `preload`, 알맞은 레이아웃에서 미리 로드되는 폰트, 그리고 그 요소를 Suspense 경계 밖에 두는 것입니다. **클라이언트로 갈 필요가 없는데 가고 있는 것은 무엇인가?** 번들 분석기, `optimizePackageImports`, 그리고 렌더링 전용 라이브러리를 서버로 옮기는 것입니다. **메인 스레드를 막고 있는 것은 무엇인가?** `next/script`의 전략과 상호작용 컴포넌트의 지연 로딩입니다.

그런 다음 Lighthouse만이 아니라 실제 사용자로 측정하세요.

## 더 읽을거리

* [Image Optimization](/docs/app/getting-started/images)과 [`<Image>` API 레퍼런스](/docs/app/api-reference/components/image)
* [Font Optimization](/docs/app/getting-started/fonts)과 [`next/font` API 레퍼런스](/docs/app/api-reference/components/font)
* [Scripts](/docs/app/guides/scripts)와 [`<Script>` API 레퍼런스](/docs/app/api-reference/components/script)
* [Lazy Loading](/docs/app/guides/lazy-loading)
* [Package Bundling](/docs/app/guides/package-bundling)과 [`optimizePackageImports`](/docs/app/api-reference/config/next-config-js/optimizePackageImports)
* [Analytics](/docs/app/guides/analytics)와 [`useReportWebVitals`](/docs/app/api-reference/functions/use-report-web-vitals)
* [Production Checklist](/docs/app/guides/production-checklist)
* [Web Vitals](https://web.dev/articles/vitals) (web.dev)
