# SEO와 메타데이터

검색 엔진이나 소셜 플랫폼이 페이지에 대해 아는 모든 것은 그 페이지의 `<head>`에서 옵니다 — 구조화된 데이터와 크롤러 파일의 경우에는 몇 가지 특수 라우트에서 옵니다. App Router는 이 모든 것을 만들어 내는 세 가지 방법을 제공하며, 실제 태그는 Next.js가 생성합니다.

1. 정적 [`metadata` 객체](#정적-메타데이터)
2. 동적 [`generateMetadata` 함수](#생성된-메타데이터)
3. [파일 규칙](#파일-기반-메타데이터) — 아이콘, OG 이미지, `robots.txt`, `sitemap.xml`

`metadata`와 `generateMetadata`는 모두 **Server Component에서만** 지원됩니다. 메타데이터는 페이지가 렌더링되기 전에 서버에서 해석되어야 초기 HTML 응답에 포함될 수 있기 때문입니다. 라우트에 클라이언트 측 상호작용이 필요하다면 `page.tsx`는 Server Component로 두고, 상호작용하는 부분만 별도의 `'use client'` 파일로 옮기세요.

## 기본 필드

메타데이터를 전혀 정의하지 않은 라우트에서도 두 개의 태그는 항상 출력됩니다.

```html
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
```

## 정적 메타데이터

`layout.js`나 `page.js`에서 `Metadata` 객체를 export합니다.

```tsx filename="app/blog/layout.tsx"
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'My Blog',
  description: '...',
}

export default function Layout() {}
```

## 생성된 메타데이터

메타데이터가 데이터에 의존한다면, 대신 async `generateMetadata` 함수를 export합니다.

```tsx filename="app/blog/[slug]/page.tsx"
import type { Metadata, ResolvingMetadata } from 'next'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateMetadata(
  { params, searchParams }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const slug = (await params).slug
  const post = await fetch(`https://api.vercel.app/blog/${slug}`).then((res) => res.json())

  return {
    title: post.title,
    description: post.description,
  }
}
```

매개변수는 다음과 같습니다.

* `params` — 루트 세그먼트부터 현재 세그먼트까지의 동적 라우트 파라미터.
* `searchParams` — URL의 검색 파라미터. **`page.js`에서만 사용할 수 있고**, 레이아웃에서는 사용할 수 없습니다.
* `parent` — 부모 세그먼트에서 이미 해석된 메타데이터의 promise.

`redirect()`와 `notFound()`는 모두 `generateMetadata` 안에서 호출할 수 있습니다.

> 메타데이터가 요청 데이터에 의존하지 않는다면 정적 `metadata` 객체를 사용하세요. `generateMetadata`는 의존하는 경우를 위한 것입니다.

### 같은 데이터를 두 번 가져오지 않기

보통 페이지는 메타데이터와 본문에 같은 레코드를 필요로 합니다. 로더를 React의 [`cache`](https://react.dev/reference/react/cache)로 감싸서 쿼리가 한 번만 실행되게 하세요.

```ts filename="app/lib/data.ts"
import { cache } from 'react'
import { db } from '@/app/lib/db'

// getPost는 두 번 사용되지만 한 번만 실행됩니다
export const getPost = cache(async (slug: string) => {
  return db.query.posts.findFirst({ where: eq(posts.slug, slug) })
})
```

```tsx filename="app/blog/[slug]/page.tsx"
import { getPost } from '@/app/lib/data'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const post = await getPost((await params).slug)
  return { title: post.title, description: post.description }
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const post = await getPost((await params).slug)
  return <div>{post.title}</div>
}
```

`fetch` 요청은 `generateMetadata`, `generateStaticParams`, 레이아웃, 페이지, Server Components 전반에 걸쳐 자동으로 메모이즈됩니다. `cache`는 `fetch`가 아닌 모든 것 — 예를 들어 데이터베이스 호출 — 을 위한 것입니다.

## 순서와 병합

메타데이터는 루트 세그먼트에서 페이지 방향으로 평가됩니다.

1. `app/layout.tsx`
2. `app/blog/layout.tsx`
3. `app/blog/[slug]/page.tsx`

라우트의 모든 세그먼트에서 온 객체는 **얕게(shallow) 병합**되고, 중복된 키는 나중 세그먼트의 값으로 대체됩니다. *얕게* 라는 말이 바로 함정입니다. `openGraph`나 `robots` 같은 중첩 객체는 필드 단위로 병합되지 않고 **통째로** 교체됩니다.

```jsx filename="app/layout.js"
export const metadata = {
  title: 'Acme',
  openGraph: { title: 'Acme', description: 'Acme is a...' },
}
```

```jsx filename="app/blog/page.js"
export const metadata = {
  title: 'Blog',
  openGraph: { title: 'Blog' },
}

// 출력:
// <title>Blog</title>
// <meta property="og:title" content="Blog" />
// ...그리고 og:description은 사라집니다.
```

`openGraph`를 아예 정의하지 않은 세그먼트는 부모의 것을 그대로 **상속**합니다. 즉 중첩 키마다 전부 아니면 전무의 선택입니다.

중첩 객체의 일부는 공유하고 나머지는 덮어쓰려면, 변수로 빼내어 전개(spread)하세요.

```jsx filename="app/shared-metadata.js"
export const openGraphImage = { images: ['http://...'] }
```

```jsx filename="app/about/page.js"
import { openGraphImage } from '../shared-metadata'

export const metadata = {
  openGraph: { ...openGraphImage, title: 'About' },
}
```

## `title`

`title`은 문자열이거나, 서로 다른 세 가지 동작을 가진 객체입니다.

```tsx filename="app/layout.tsx"
export const metadata: Metadata = {
  title: {
    default: 'Acme',        // title을 설정하지 않은 자식을 위한 대체값
    template: '%s | Acme',  // 자식의 title이 끼워 넣어지는 패턴
  },
}
```

```tsx filename="app/about/page.tsx"
export const metadata: Metadata = {
  title: 'About',            // -> <title>About | Acme</title>
}

// 또는, 부모 템플릿을 완전히 벗어나려면:
export const metadata: Metadata = {
  title: { absolute: 'About' }, // -> <title>About</title>
}
```

| 키 | `layout.js`에서 | `page.js`에서 |
| --- | --- | --- |
| `title` (문자열) | title이 없는 자식을 위한 기본 title이자, 자신도 가장 가까운 부모의 `template`에 끼워집니다. | 해당 라우트의 title이며, 가장 가까운 부모의 `template`에 끼워집니다. |
| `title.default` | title이 없는 자식 세그먼트를 위한 대체값. | — |
| `title.template` | **자식** 세그먼트를 위한 새 템플릿을 정의합니다. | **효과 없음** — 페이지는 항상 마지막 세그먼트입니다. |
| `title.absolute` | 부모 템플릿을 무시하는, 자식을 위한 기본 title. | 부모 템플릿을 무시하는 해당 라우트의 title. |

이 프로젝트의 루트 레이아웃은 이미 이 패턴을 사용하고 있습니다.

```tsx filename="app/layout.tsx"
export const metadata: Metadata = {
  title: {
    default: 'Todos — Next.js App Router practice',
    template: '%s — Next.js practice',
  },
  description: 'A Todo app built while working through the App Router notes in note/.',
}
```

## `metadataBase`와 URL 합성

여러 메타데이터 필드는 **완전히 정규화된(fully qualified)** URL을 요구합니다. `metadataBase`를 쓰면 현재 세그먼트와 그 아래에서 상대 경로를 대신 쓸 수 있습니다.

```jsx filename="app/layout.js"
export const metadata = {
  metadataBase: new URL('https://acme.com'),
  alternates: {
    canonical: '/',
    languages: { 'en-US': '/en-US', 'de-DE': '/de-DE' },
  },
  openGraph: { images: '/og-image.png' },
}
```

```html
<link rel="canonical" href="https://acme.com" />
<link rel="alternate" hreflang="en-US" href="https://acme.com/en-US" />
<meta property="og:image" content="https://acme.com/og-image.png" />
```

루트 레이아웃에서 한 번만 설정하세요. 합성은 엄밀한 URL 의미론보다 개발자의 의도를 우선합니다. 메타데이터 필드의 "절대" 경로는 기존 경로를 대체하지 않고 base에 대한 상대 경로로 취급됩니다.

| 필드 값 | 해석된 URL |
| --- | --- |
| `/` 또는 `./` | `https://acme.com` |
| `payments`, `/payments`, `./payments`, `../payments` | `https://acme.com/payments` |
| `https://beta.acme.com/payments` | `https://beta.acme.com/payments` (base 무시) |

> **주의할 점.** `metadataBase`를 설정하지 않은 채 상대 URL을 쓰면 **빌드 오류**입니다. 그리고 `generateMetadata`가 `'use cache'`를 사용할 때 반환값은 직렬화 가능해야 하는데 `URL` 인스턴스는 그렇지 않으므로, `url.toString()`으로 반환해야 합니다.

## 중요한 필드들

### `description`

```jsx
export const metadata = { description: 'The React Framework for the Web' }
```

### `alternates` — canonical과 hreflang

canonical URL은 중복 콘텐츠 문제를 피하는 데 있어 가장 중요한 단일 필드입니다.

```jsx
export const metadata = {
  alternates: {
    canonical: 'https://nextjs.org',
    languages: {
      'en-US': 'https://nextjs.org/en-US',
      'de-DE': 'https://nextjs.org/de-DE',
    },
    media: { 'only screen and (max-width: 600px)': 'https://nextjs.org/mobile' },
    types: { 'application/rss+xml': 'https://nextjs.org/rss' },
  },
}
```

### `robots`

페이지 단위의 크롤링 지시자이며, Googlebot 전용 블록을 선택적으로 포함할 수 있습니다.

```tsx
export const metadata: Metadata = {
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}
```

```html
<meta name="robots" content="index, follow" />
<meta name="googlebot" content="index, follow, max-video-preview:-1, max-image-preview:large, max-snippet:-1" />
```

이것은 페이지 단위입니다. 사이트 전체의 크롤링 규칙은 [`robots.txt`](#robotstxt)에 속합니다.

### `openGraph`

```jsx
export const metadata = {
  openGraph: {
    title: 'Next.js',
    description: 'The React Framework for the Web',
    url: 'https://nextjs.org',
    siteName: 'Next.js',
    images: [
      { url: 'https://nextjs.org/og.png', width: 800, height: 600 },
      { url: 'https://nextjs.org/og-alt.png', width: 1800, height: 1600, alt: 'My custom alt' },
    ],
    locale: 'en_US',
    type: 'website',
  },
}
```

`type: 'article'`은 기사 전용 태그를 열어 줍니다.

```jsx
openGraph: {
  type: 'article',
  publishedTime: '2023-01-01T00:00:00.000Z',
  authors: ['Seb', 'Josh'],
}
```

```html
<meta property="article:published_time" content="2023-01-01T00:00:00.000Z" />
<meta property="article:author" content="Seb" />
```

> OG **이미지**에는 보통 이 설정보다 [파일 규칙](#open-graph-이미지)이 낫습니다. 동기화를 유지할 대상이 아예 없기 때문입니다.

### 그 외

`twitter`는 X 카드를 위해 `openGraph`를 그대로 따릅니다. `verification`은 서치 콘솔 소유권 토큰을 담습니다. `icons`, `manifest`, `themeColor`, `appleWebApp`, `category`, `facebook`, `pinterest`, 그리고 자유 형식의 `other`도 모두 사용할 수 있습니다 — 다만 파일 규칙이 존재하는 것은 그쪽을 우선하세요.

## 파일 기반 메타데이터

| 파일 | 위치 | 생성되는 것 |
| --- | --- | --- |
| `favicon.ico` | `app/`에만 | `<link rel="icon">` |
| `icon.(ico\|jpg\|jpeg\|png\|svg)` | 모든 세그먼트 | `<link rel="icon">` |
| `apple-icon.(jpg\|jpeg\|png)` | 모든 세그먼트 | `<link rel="apple-touch-icon">` |
| `opengraph-image.(jpg\|jpeg\|png\|gif)` | 모든 세그먼트 | `og:image` + type/width/height |
| `twitter-image.(jpg\|jpeg\|png\|gif)` | 모든 세그먼트 | `twitter:image` + type/width/height |
| `*.alt.txt` | 이미지 옆 | `og:image:alt` / `twitter:image:alt` |
| `robots.(txt\|js\|ts)` | `app/` | `/robots.txt` |
| `sitemap.(xml\|js\|ts)` | `app/` | `/sitemap.xml` |
| `manifest.(json\|js\|ts)` | `app/` | `/manifest.json` |

이들 각각은 실제 파일일 수도 있고, **코드로 해당 결과물을 생성하는** `.js`/`.ts` 라우트일 수도 있습니다.

### 아이콘

`app/`에 `favicon.ico`를 두면 Next.js가 파일 자체로부터 `rel`, `type`, `sizes`를 알아냅니다 — 32×32 PNG는 `type="image/png" sizes="32x32"`가 되고, SVG는 `sizes="any"`가 됩니다. 아이콘을 여러 개 두려면 번호가 붙은 이름(`icon1.png`, `icon2.png`)을 쓰며 사전순으로 정렬됩니다. `favicon`은 `app/`의 최상위에서만 동작하므로, 세그먼트별 제어가 필요하면 `icon`을 사용하세요.

### Open Graph 이미지

사이트 전체 이미지는 `app/`에 `opengraph-image.jpg`를 두고, 라우트별 이미지는 트리 더 깊은 곳에 둡니다 — **더 구체적인 파일이 우선합니다.** 옆에 `opengraph-image.alt.txt`를 두면 대체 텍스트가 됩니다.

> 크기 제한은 빌드 시점에 강제됩니다. `twitter-image`는 5MB 이하, `opengraph-image`는 8MB 이하여야 하며, 넘으면 빌드가 실패합니다.

### `ImageResponse`로 OG 이미지 생성하기

데이터에 의존하는 이미지는 `opengraph-image.tsx`와 `next/og`의 `ImageResponse` 생성자를 사용합니다.

```tsx filename="app/blog/[slug]/opengraph-image.tsx"
import { ImageResponse } from 'next/og'
import { getPost } from '@/app/lib/data'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const post = await getPost((await params).slug)

  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 128,
          background: 'white',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {post.title}
      </div>
    )
  )
}
```

`ImageResponse`는 satori와 resvg를 통해 HTML과 CSS를 PNG로 변환합니다. **flexbox와 일부 CSS만 지원되며** `display: grid`는 동작하지 않습니다. 커스텀 폰트, 텍스트 줄바꿈, 절대 위치 지정, 중첩 이미지는 동작합니다.

### `robots.txt`

정적 파일:

```txt filename="app/robots.txt"
User-Agent: *
Allow: /
Disallow: /private/

Sitemap: https://acme.com/sitemap.xml
```

또는 에이전트별 규칙과 함께 생성:

```ts filename="app/robots.ts"
import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: 'Googlebot', allow: ['/'], disallow: '/private/' },
      { userAgent: ['Applebot', 'Bingbot'], disallow: ['/'] },
    ],
    sitemap: 'https://acme.com/sitemap.xml',
  }
}
```

비표준 지시자(Yandex의 `Clean-param`, Seznam의 `Request-Rate`)는 **v16.3**에 추가된 `other` 필드를 통해 전달합니다. 값은 그대로 전달되며 검증되지 않습니다.

```ts
{ userAgent: 'SeznamBot', allow: '/', other: { 'Request-Rate': '10/1m' } }
```

> `robots.js`는 Route Handler이며, 요청 시점 API나 동적 설정을 사용하지 않는 한 **기본으로 캐시됩니다.**

### `sitemap.xml`

작은 사이트는 실제 `app/sitemap.xml` 파일을 두면 됩니다. 그렇지 않다면 생성하세요.

```ts filename="app/sitemap.ts"
import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://acme.com', lastModified: new Date(), changeFrequency: 'yearly', priority: 1 },
    { url: 'https://acme.com/about', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://acme.com/blog', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.5 },
  ]
}
```

각 항목은 이미지·비디오 사이트맵 네임스페이스를 출력하는 `images`와 `videos` 배열, 그리고 지역화된 사이트맵을 위한 `alternates.languages`도 받습니다. `robots.js`와 마찬가지로 기본으로 캐시됩니다.

### 큰 사이트맵 분할하기

Google의 제한은 **사이트맵당 50,000개 URL**입니다. `generateSitemaps`는 여러 개의 사이트맵을 만들며 `/.../sitemap/[id].xml`로 제공됩니다.

```ts filename="app/product/sitemap.ts"
import type { MetadataRoute } from 'next'
import { BASE_URL } from '@/app/lib/constants'

export async function generateSitemaps() {
  return [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }]
}

export default async function sitemap(props: { id: Promise<string> }): Promise<MetadataRoute.Sitemap> {
  const id = await props.id
  const start = Number(id) * 50000
  const products = await getProducts(
    `SELECT id, date FROM products WHERE id BETWEEN ${start} AND ${start + 50000}`
  )
  return products.map((product) => ({
    url: `${BASE_URL}/product/${product.id}`,
    lastModified: product.date,
  }))
}
```

> **v16에서 변경됨:** `id`는 이제 문자열로 resolve되는 **promise**로 전달되므로 await 해야 합니다.

## 구조화된 데이터 (JSON-LD)

[JSON-LD](https://json-ld.org/)는 페이지가 *무엇인지* — 제품, 레시피, 이벤트, 인물 — 를 검색 엔진과 AI 시스템이 활용할 수 있는 형태로 기술합니다. 현재 권장 방식은 `layout.js`나 `page.js`에서 일반 `<script>` 태그를 렌더링하는 것입니다.

```tsx filename="app/products/[id]/page.tsx"
export default async function Page({ params }) {
  const product = await getProduct((await params).id)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    image: product.image,
    description: product.description,
  }

  return (
    <section>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
        }}
      />
      {/* ... */}
    </section>
  )
}
```

주의할 점이 두 가지 있습니다.

* **`JSON.stringify`는 살균(sanitize)하지 않습니다.** 데이터 안의 `<` 하나가 script 태그를 닫고 XSS 구멍을 열 수 있으며, 그래서 유니코드 이스케이프 `<`로 치환합니다. 조직에서 권장하는 살균 방식을 쓰거나 [`serialize-javascript`](https://www.npmjs.com/package/serialize-javascript) 같은 라이브러리를 사용하세요.
* **`next/script`가 아니라 네이티브 `<script>`를 쓰세요.** `next/script`는 JavaScript의 로딩과 실행을 최적화하는 도구이고, JSON-LD는 코드가 아니라 데이터입니다.

컴파일 타임 검사를 원한다면 [`schema-dts`](https://www.npmjs.com/package/schema-dts)로 타입을 붙이고, 결과는 Google의 [Rich Results Test](https://search.google.com/test/rich-results)나 [Schema Markup Validator](https://validator.schema.org/)로 검증하세요.

## Metadata API가 다루지 않는 것

| 태그 | 대신 사용할 것 |
| --- | --- |
| `<meta http-equiv>` | HTTP 헤더 — `redirect()`, 프록시, 또는 `headers` 설정 |
| `<base>`, `<noscript>` | 레이아웃이나 페이지에서 직접 태그를 렌더링 |
| `<style>`, `<link rel="stylesheet">` | 스타일시트를 직접 import |
| `<script>` | `next/script` |
| `<link rel="preload" / "preconnect" / "dns-prefetch">` | 아래의 ReactDOM 메서드 |

리소스 힌트는 Client Component에서 `ReactDOM`을 통해 전달합니다.

```tsx filename="app/preload-resources.tsx"
'use client'

import ReactDOM from 'react-dom'

export function PreloadResources() {
  ReactDOM.preload('...', { as: '...' })
  ReactDOM.preconnect('...', { crossOrigin: '...' })
  ReactDOM.prefetchDNS('...')

  return null
}
```

`next/font`, `next/image`, `next/script`는 이미 각자의 힌트를 출력하므로, 이것은 직접 로드하는 리소스에만 해당합니다.

## SEO에 영향을 주는 렌더링 동작

### 스트리밍 메타데이터

동적으로 렌더링되는 페이지에서 Next.js는 `generateMetadata`를 기다리느라 응답을 막지 **않습니다.** UI가 먼저 스트리밍되고, 메타데이터 태그는 해석되는 대로 `<body>`에 덧붙습니다. 이는 TTFB를 낮추고 LCP를 개선할 수 있습니다.

JavaScript를 실행하고 전체 DOM을 읽는 크롤러(예: Googlebot)에게는 안전합니다. 그렇지 않은 **HTML 제한 봇** — `facebookexternalhit`, `Twitterbot`, `Slackbot`, `Bingbot` — 에 대해서는 Next.js가 User-Agent를 감지해 블로킹 방식으로 되돌리므로, 메타데이터가 그 봇들이 기대하는 `<head>`에 들어갑니다.

감지 목록을 재정의하거나 스트리밍 메타데이터를 완전히 끌 수 있습니다.

```ts filename="next.config.ts"
const config: NextConfig = {
  htmlLimitedBots: /.*/,
}
```

거의 모든 경우에 기본값이 적절하며, 재정의하면 응답 시간을 대가로 치릅니다. 프리렌더링된 페이지는 애초에 메타데이터를 스트리밍하지 않습니다 — 빌드 시점에 해석되기 때문입니다.

### Cache Components와 함께

Cache Components가 활성화되면 `generateMetadata`도 다른 컴포넌트와 같은 규칙을 따릅니다. 런타임 데이터(`cookies()`, `headers()`, `params`, `searchParams`)를 읽거나 캐시되지 않은 페칭을 하면 요청 시점으로 미뤄집니다.

* 페이지의 나머지도 요청 시점으로 미뤄진다면, 메타데이터는 다른 것들과 함께 스트리밍될 뿐입니다.
* 페이지가 **그 외에는 완전히 프리렌더링 가능하다면**, Next.js는 페이지를 조용히 동적으로 만들지 않고 오류를 발생시키며 고쳐야 할 페이지나 레이아웃을 알려 줍니다.

해결 방법은 두 가지입니다. 메타데이터가 외부 데이터에는 의존하지만 요청에는 의존하지 않는다면 캐시하세요.

```tsx filename="app/page.tsx"
export async function generateMetadata() {
  'use cache'
  const { title, description } = await db.query('site-metadata')
  return { title, description }
}
```

정말로 런타임 데이터가 필요하다면, 마커 컴포넌트로 그 의도를 선언해 정적 콘텐츠는 계속 프리렌더링되게 하세요.

```tsx filename="app/page.tsx"
import { Suspense } from 'react'
import { connection } from 'next/server'

const Connection = async () => {
  await connection()
  return null
}

function DynamicMarker() {
  return (
    <Suspense>
      <Connection />
    </Suspense>
  )
}

export default function Page() {
  // 여기에 `await connection()`을 두지 마세요 —
  // article이 정적 셸에서 빠지게 됩니다.
  return (
    <>
      <article>Static content</article>
      <DynamicMarker />
    </>
  )
}
```

주변 모델에 대해서는 [NextJs_Caching.md](NextJs_Caching.md)와 [NextJs_Rendering.md](NextJs_Rendering.md)를 참고하세요.

## 요약

메타데이터는 루트 레이아웃에서 페이지 방향으로 서버에서 해석되며 얕게 병합됩니다 — 즉 `openGraph` 같은 중첩 객체는 부분 수정이 아니라 통째로 교체됩니다. 사이트 전체 기본값(`metadataBase`, `title.template`, `openGraph`)은 루트 레이아웃에 두고, 라우트별로 거기서부터 덮어쓰세요.

`generateMetadata`는 값이 데이터에 의존할 때만 꺼내 쓰고, 로더는 React의 `cache`로 감싸 같은 레코드를 두 번 가져오지 않게 하세요. 파일 규칙이 있는 것 — 아이콘, OG 이미지, `robots.txt`, `sitemap.xml` — 은 파일을 쓰세요. 실제와 어긋날 설정이 아예 없습니다.

나머지는 규율의 문제입니다. 모든 페이지에 canonical URL을, 모든 이미지에 `alt` 텍스트를, JSON-LD는 DOM에 닿기 전에 이스케이프하고, 사이트맵은 파일당 50,000개 URL 아래로 유지하세요.

## 더 읽을거리

* [Metadata and OG images](/docs/app/getting-started/metadata-and-og-images) — 이 노트가 요약한 가이드
* [`generateMetadata`](/docs/app/api-reference/functions/generate-metadata) — 전체 필드 레퍼런스
* [Metadata file conventions](/docs/app/api-reference/file-conventions/metadata)
* [`ImageResponse`](/docs/app/api-reference/functions/image-response) — 지원되는 CSS와 폰트
* [JSON-LD](/docs/app/guides/json-ld)
* [`generateSitemaps`](/docs/app/api-reference/functions/generate-sitemaps)
* [Vercel OG Playground](https://og-playground.vercel.app/) — `ImageResponse` 결과 미리보기
* [Rich Results Test](https://search.google.com/test/rich-results) — 구조화된 데이터 검증
