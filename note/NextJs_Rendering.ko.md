# 렌더링

렌더링은 컴포넌트 트리를 HTML로 바꾸는 작업입니다. App Router에서는 이 작업이 **빌드 시점**, **요청 시점**, **브라우저**라는 세 시점으로 나뉩니다. 이 노트에서는 페이지의 각 부분이 어디에서 렌더링되는지, Next.js가 그것을 어떻게 결정하는지, 그리고 그 결과가 어떻게 스트림으로 브라우저에 전달되는지를 다룹니다.

> **문서에 대한 참고:** 이 버전의 Next.js에는 "Rendering"이라는 단일 문서 페이지가 없습니다. 렌더링 모델은 [Rendering Philosophy](/docs/app/guides/rendering-philosophy), [Streaming](/docs/app/guides/streaming), [Caching](/docs/app/getting-started/caching), [Glossary](/docs/app/glossary)에 나뉘어 설명되어 있습니다. 이 노트는 그 내용을 하나로 모은 것입니다.

## 렌더링이 일어나는 시점

| 시점 | 무슨 일이 일어나는가 | 결과물 |
| --- | --- | --- |
| **빌드 시점** (`next build`) | 요청 데이터에 의존하지 않는 컴포넌트가 **프리렌더링**됩니다 | HTML + RSC 페이로드, CDN에 캐시 가능 |
| **요청 시점** | 요청 데이터를 읽거나 캐시되지 않은 비동기 작업을 하는 컴포넌트가 요청마다 렌더링됩니다 | 열려 있는 응답으로 스트리밍되는 HTML 청크 |
| **브라우저** | React가 스트리밍된 HTML을 **하이드레이션**하고 상호작용을 넘겨받습니다 | 상호작용 가능한 페이지 |

같은 것을 가리키는 이름이 두 쌍 있고, 문서에는 둘 다 등장합니다.

* **프리렌더링(Prerendering)** = **정적 렌더링(Static rendering)**: 컴포넌트가 빌드 시점에, 또는 [재검증](/docs/app/glossary#revalidation) 중 백그라운드에서 렌더링됩니다. 결과물은 HTML과 [RSC 페이로드](/docs/app/getting-started/server-and-client-components#on-the-server)이며 CDN에서 캐시해 제공할 수 있습니다. 요청 시점 API를 사용하지 않는 컴포넌트의 기본 동작입니다.
* **동적 렌더링(Dynamic rendering)** = **런타임 렌더링(Runtime rendering)**: 요청이 도착해야만 존재하는 값이 필요하기 때문에 요청 시점에 렌더링됩니다.

**하이드레이션**은 HTML이 도착한 뒤에 일어나는 일입니다. React가 서버에서 렌더링된 DOM에 이벤트 핸들러를 붙이고 마크업을 클라이언트 JavaScript와 대조하여, 정적 HTML을 상호작용 가능하게 만듭니다.

## 스펙트럼으로서의 정적과 동적

대부분의 웹 프레임워크는 정적과 동적 사이에 **라우트 단위**로 선을 긋습니다. 페이지는 빌드 시점에 프리렌더링되거나, 요청 시점에 서버에서 렌더링되거나 둘 중 하나입니다. 이해하기 쉽고 배포하기도 쉽습니다. 정적 파일은 CDN에 올리고 동적 라우트는 서버로 보내면 됩니다.

Next.js는 다른 방식을 택합니다. **정적과 동적의 경계가 라우트 단위가 아니라 컴포넌트 단위에 있습니다.** 하나의 페이지가 즉시 로드되는 정적 셸과, 준비되는 대로 스트리밍되는 동적 섹션을 함께 가질 수 있습니다. 캐시된 함수가 동적 라우트 안에 존재할 수 있고, 정적 페이지를 재배포 없이 갱신할 수도 있습니다.

Partial Prerendering, [Cache Components](/docs/app/getting-started/caching)(`use cache`), 온디맨드 재검증이 함께 가능하게 만드는 것이 바로 이것입니다. 이들은 개별적으로 추가된 기능이 아니라, 정적과 동적을 양자택일이 아닌 스펙트럼으로 다루는 하나의 렌더링 모델입니다.

### 세 가지 모델 비교

| 모델 | 경계 | 배포 | 대가 |
| --- | --- | --- | --- |
| **빌드 시점 프리렌더링** | 애플리케이션 전체 | 어떤 CDN이나 파일 서버에든 정적 파일만 올리면 되고 런타임 인프라가 필요 없음 | 콘텐츠가 바뀔 때마다 다시 빌드하고 배포해야 하며, 동적 콘텐츠는 로드 후 클라이언트에서 가져와야 함 |
| **라우트 단위 경계** | 라우트마다 | 정적 파일은 CDN, 동적 라우트는 서버 | 라우트 단위의 전부 아니면 전무. 대부분 정적인 페이지에 실시간 요소가 하나만 있어도 페이지 전체를 동적으로 만들거나 그 요소를 클라이언트에서 가져와야 함 |
| **컴포넌트 단위 경계** (Next.js) | 컴포넌트마다 | 정적 콘텐츠와 동적 콘텐츠가 하나의 스트리밍 응답 안에 공존 | 인프라 복잡도가 애플리케이션 코드에서 호스팅 플랫폼으로 이동 |

### 컴포넌트 단위 모델이 가능하게 하는 것

* **체감 로딩 속도 향상.** 정적 셸이 즉시 렌더링되고 동적 콘텐츠는 그 뒤에 스트리밍됩니다. 사용자는 페이지 전체를 기다리지 않고 의미 있는 콘텐츠를 바로 봅니다.
* **점진적인 캐싱.** 라우트가 정적인지 동적인지를 빌드 시점에 미리 결정하지 않고도 캐싱과 재검증을 점진적으로 도입할 수 있습니다. 어떤 페이지든 온디맨드로 재검증할 수 있고, 어떤 함수든 [`use cache`](/docs/app/api-reference/directives/use-cache)로 캐시할 수 있습니다.
* **세밀한 캐싱.** 라우트가 아니라 함수를 캐시하고, 배포가 아니라 [태그](/docs/app/api-reference/functions/revalidateTag)를 재검증합니다. 비용이 큰 데이터베이스 쿼리를 페이지의 나머지 부분과 독립적으로 캐시할 수 있습니다.

## 무엇이 컴포넌트를 동적으로 만드는가

요청마다 달라지는 값을 건드리는 순간, 컴포넌트는 요청 시점에 렌더링됩니다.

* **요청 시점 API(Request-time APIs)** — [`cookies()`](/docs/app/api-reference/functions/cookies), [`headers()`](/docs/app/api-reference/functions/headers), [`searchParams`](/docs/app/api-reference/file-conventions/page#searchparams-optional), [`draftMode()`](/docs/app/api-reference/functions/draft-mode), 그리고 [`generateStaticParams`](/docs/app/api-reference/functions/generate-static-params)로 나열하지 않은 `params`. 캐싱 문서에서는 이들을 **런타임 API**라고 부릅니다.
* **캐시되지 않은 비동기 작업** — API `fetch`, 데이터베이스 쿼리를 비롯해 [`use cache`](/docs/app/api-reference/directives/use-cache)로 감싸지 않은 모든 비동기 작업.
* **결정적이지 않은 값** — `Math.random()`, `Date.now()`, `new Date()`. 프리렌더링 결과에 고정할 수 없는 값이므로, 요청마다 새 값이 필요하면 `<Suspense>` 경계 안에서 `connection()`을 사용하고, 모든 사용자가 같은 값을 공유해도 된다면 `use cache`를 사용합니다.

반대로 모듈 import, `fs.readFileSync`, 순수 계산은 프리렌더링 중에 완료되어 자동으로 정적 셸에 포함됩니다.

**이 모든 것을 관통하는 규칙:** 프리렌더러는 동적 작업을 만나면 폴백으로 사용할 가장 가까운 `<Suspense>` 경계를 찾아 트리 **위쪽으로** 올라갑니다. 그 경계보다 위에 있는 것은 모두 프리렌더링되고, 경계 안의 콘텐츠는 요청 시점에 스트리밍됩니다. 경계를 찾지 못하면 빌드는 [blocking route 오류](/docs/messages/blocking-prerender-dynamic)와 함께 실패합니다.

따라서 개발자가 실제로 내리는 결정은 두 가지입니다. **무엇을 캐시할 것인가**, 그리고 **Suspense 경계를 어디에 둘 것인가**.

## 용어 정리

| 용어 | 의미 |
| --- | --- |
| **프리렌더링 / 정적 렌더링** | 빌드 시점(또는 백그라운드 재검증 중)의 렌더링. HTML + RSC 페이로드를 만듭니다. |
| **동적 렌더링 / 런타임 렌더링** | 요청 시점의 렌더링. 요청 시점 API나 캐시되지 않은 비동기 작업이 원인이 됩니다. |
| **정적 셸(Static shell)** | 즉시 전달되는 프리렌더링된 HTML. 레이아웃, 내비게이션, 그리고 나중에 스트리밍될 부분의 Suspense 폴백으로 이루어집니다. |
| **App Shell** | URL 데이터에 의존하지 않는 부분만 담은 라우트별 프리렌더. 기본 프리페치 페이로드이자, 빌드 시점에 알 수 없는 params에 대한 ISR 폴백으로 쓰입니다. |
| **부분 프리렌더링(PPR)** | 하나의 라우트에서 프리렌더링과 동적 렌더링을 결합하는 방식. 셸을 먼저 보내고 동적 콘텐츠를 뒤이어 스트리밍합니다. Cache Components의 기본 동작입니다. |
| **스트리밍** | 전체 렌더링이 끝나기를 기다리지 않고, 준비된 부분부터 보내는 것. |
| **Suspense 경계** | React `<Suspense>` 컴포넌트. Next.js에서는 정적 셸이 끝나고 스트리밍이 시작되는 지점을 나타냅니다. |
| **RSC 페이로드** | 렌더링된 서버 컴포넌트 트리의 압축된 바이너리 표현. 서버 컴포넌트의 렌더링 결과, 클라이언트 컴포넌트 자리표시자, 그 사이에 전달되는 props가 담깁니다. |
| **하이드레이션** | React가 서버에서 렌더링된 HTML에 이벤트 핸들러를 붙여 상호작용 가능하게 만드는 과정. |
| **ISR** | 사이트 전체를 다시 빌드하지 않고 프리렌더링된 콘텐츠를 갱신하는 것. 재검증이라고도 합니다. |

`use cache`, `cacheLife`, 정적 셸, 프리페칭의 세부 내용은 [캐싱](/docs/app/getting-started/caching) 가이드에 있습니다. 이 노트는 그 내용을 전제하고 렌더링과 전달 과정에 집중합니다.

## App Router가 페이지를 전달하는 방식

전통적인 서버 사이드 렌더링에서는 서버가 HTML 문서 전체를 완성한 뒤에야 응답을 보내기 시작하므로, 느린 데이터베이스 쿼리 하나가 페이지 전체를 막습니다. 스트리밍은 [청크 전송 인코딩](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Transfer-Encoding)을 사용해 준비된 부분부터 응답을 보내는 방식으로 이 문제를 해결합니다. 서버가 나머지를 생성하는 동안 브라우저는 이미 받은 HTML을 렌더링하기 시작합니다.

React의 서버 렌더러는 `<Suspense>` 경계에 맞춰 HTML을 청크 단위로 생성하고, App Router가 이를 통합하고 있어 별도 설정 없이 스트리밍이 동작합니다. 최초 페이지 로드에서는 두 개의 스트림이 함께 동작합니다.

### HTML 스트림

React의 서버 렌더러는 HTML 청크를 순차적으로 생성합니다. 페이지의 정적인 부분(레이아웃, 내비게이션, Suspense 폴백)이 먼저 렌더링되어 즉시 전송됩니다. 경계 안의 콘텐츠가 준비되면, 예를 들어 비동기 서버 컴포넌트가 완료되면, React는 완성된 HTML과 함께 두 개의 인라인 `<script>` 태그를 스트리밍합니다. 하나는 폴백 DOM 노드를 새 콘텐츠로 교체하고, 다른 하나는 나중에 하이드레이션할 수 있도록 컴포넌트 페이로드를 담습니다. 브라우저는 JavaScript 번들 로드나 하이드레이션을 기다리지 않고 즉시 교체를 수행합니다. 사용자가 *보는* 것이 바로 이 과정, 즉 페이지가 구역 단위로 그려지는 모습입니다.

### 컴포넌트 페이로드

컴포넌트 페이로드는 React가 페이지를 하이드레이션하고 클라이언트 업데이트를 처리하는 데 사용하는, 직렬화된 컴포넌트 트리 표현입니다. 최초 로드에서는 HTML 스트림에 포함되어 전달됩니다. **클라이언트 사이드 내비게이션**에서는 컴포넌트 페이로드만 (`rsc: 1` 요청 헤더와 함께) 가져오고 HTML은 전혀 전송되지 않습니다. React가 컴포넌트 트리를 그 자리에서 갱신합니다.

### 정적 셸

비동기 작업이 완료되기 전에 렌더링되는 모든 것이 **정적 셸**입니다. 레이아웃, 내비게이션, 그리고 Suspense 경계가 정의한 폴백 UI가 여기에 해당합니다. 정적 셸은 즉시 전송되므로, 동적 콘텐츠가 스트리밍되는 동안 사용자는 무언가를 보고 상호작용할 수 있습니다. [Cache Components](/docs/app/getting-started/caching)를 사용하면 정적 셸은 빌드 시점에 프리렌더링되어 엣지에서 즉시 제공됩니다.

![스트리밍을 사용한 서버 렌더링의 동작 방식](https://h8DxKfmAPhn8O0p3.public.blob.vercel-storage.com/docs/light/server-rendering-with-streaming.png)

각 `<Suspense>` 경계는 독립적인 스트리밍 지점입니다. 서로 다른 경계 안의 컴포넌트는 각자 완료되는 대로 스트리밍되며 서로를 막지 않습니다.

## `loading.js`를 사용한 페이지 단위 스트리밍

스트리밍을 도입하는 가장 간단한 방법은 `page.js` 옆에 `loading.js` 파일을 두는 것입니다. Next.js가 페이지 콘텐츠를 자동으로 `<Suspense>` 경계로 감싸고, 이 로딩 컴포넌트를 폴백으로 사용합니다.

![loading.js 특수 파일](https://h8DxKfmAPhn8O0p3.public.blob.vercel-storage.com/docs/light/loading-special-file.png)

```tsx filename="app/dashboard/loading.tsx" switcher
export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="h-8 w-48 bg-gray-200 rounded mb-4" />
      <div className="h-4 w-full bg-gray-200 rounded mb-2" />
      <div className="h-4 w-full bg-gray-200 rounded mb-2" />
      <div className="h-4 w-2/3 bg-gray-200 rounded" />
    </div>
  )
}
```

내부적으로 `loading.js`는 `layout.js` 안에 중첩되어 `page.js`를 `<Suspense>` 경계로 감쌉니다.

![loading.js 개요](https://h8DxKfmAPhn8O0p3.public.blob.vercel-storage.com/docs/light/loading-overview.png)

즉, 다음과 같이 동작합니다.

* 레이아웃은 정적 셸의 일부로 즉시 렌더링됩니다.
* 로딩 스켈레톤이 Suspense 폴백으로 즉시 표시됩니다.
* 페이지 컴포넌트가 완료되면 그 HTML이 스켈레톤을 대체합니다.

`loading.js`는 페이지의 데이터가 준비되기 전까지 보여줄 만한 것이 없을 때 적합합니다. 자세한 내용은 [`loading.js` API 레퍼런스](/docs/app/api-reference/file-conventions/loading)를 참고하세요.

## `<Suspense>`를 사용한 세밀한 스트리밍

`<Suspense>`를 사용하면 페이지의 어느 부분이 독립적으로 스트리밍될지 정확히 제어할 수 있습니다. 페이지 전체를 스켈레톤으로 덮는 대신 폴백을 특정 구역 아래로 내리면, 정적 셸에 실제 콘텐츠가 더 많이 포함됩니다.

### 형제 경계를 사용한 병렬 스트리밍

여러 컴포넌트가 비동기 작업을 한다면 각각을 자기 경계로 감싸세요. 각 경계는 자신의 작업이 끝나는 순서대로 독립적으로 스트리밍됩니다.

```tsx filename="app/dashboard/page.tsx" switcher
import { Suspense } from 'react'
import { Revenue } from './revenue'
import { RecentOrders } from './recent-orders'
import { Recommendations } from './recommendations'

export default function Dashboard() {
  return (
    <div>
      <h1>Dashboard</h1>
      <div className="grid grid-cols-2 gap-4">
        <Suspense fallback={<p>Loading revenue...</p>}>
          <Revenue />
        </Suspense>
        <Suspense fallback={<p>Loading orders...</p>}>
          <RecentOrders />
        </Suspense>
      </div>
      <Suspense fallback={<p>Loading recommendations...</p>}>
        <Recommendations />
      </Suspense>
    </div>
  )
}
```

`Revenue`가 200ms, `RecentOrders`가 1초, `Recommendations`가 3초에 완료된다면, 사용자는 각 구역의 데이터가 준비되는 즉시 그 구역을 보게 됩니다.

### 점진적인 상세 표시를 위한 중첩 경계

경계를 중첩하면 단계적으로 드러나는 로딩 경험을 만들 수 있습니다. 헤더를 먼저, 상품 상세를 그다음, 리뷰를 마지막에 보여주는 식입니다.

```tsx filename="app/product/[id]/page.tsx" switcher
import { Suspense } from 'react'
import { ProductDetails } from './product-details'
import { Reviews } from './reviews'

export async function generateStaticParams() {
  const products = await getTopProducts()
  return products.map((product) => ({ id: product.id }))
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <div>
      <h1>Product</h1>
      <Suspense fallback={<p>Loading product details...</p>}>
        <ProductDetails id={id} />
        <Suspense fallback={<p>Loading reviews...</p>}>
          <Reviews productId={id} />
        </Suspense>
      </Suspense>
    </div>
  )
}
```

바깥 경계는 `ProductDetails`가 완료될 때까지 "Loading product details..."를 보여줍니다. 그 후에야 안쪽 경계가 드러나 `Reviews`가 완료될 때까지 "Loading reviews..."를 보여줍니다.

### 동적 접근을 아래로 내리기

즉시 스트리밍되는 부분을 최대로 늘리는 핵심은, 동적 데이터 접근을 그 값이 실제로 필요한 컴포넌트까지 미루는 것입니다. 이는 `params`, `searchParams`, `cookies()`, `headers()`, 데이터 fetch 모두에 적용됩니다. **레이아웃이나 페이지 최상단에서 이들 중 하나라도 await 하면, 그 아래 전체가 동적이 되어 정적 셸에 포함될 수 없습니다.**

대신 작업은 시작하되 프로미스를 아래로 내려보내고, 그 값을 사용하는 컴포넌트가 경계 안에서 해결하도록 하세요.

```tsx filename="app/dashboard/layout.tsx" switcher
import { Suspense } from 'react'
import { Nav } from './nav'
import { UserMenu } from './user-menu'
import { cookies } from 'next/headers'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = cookies() // 작업은 시작하되 await 하지 않습니다

  return (
    <div>
      <Nav>
        <Suspense fallback={<p>Loading user...</p>}>
          <UserMenu cookiePromise={cookieStore} />
        </Suspense>
      </Nav>
      {children}
    </div>
  )
}
```

레이아웃에서 아무것도 await 하지 않기 때문에 `<Nav>`와 `{children}`은 정적 셸의 일부로 렌더링됩니다. 쿠키 프로미스를 해결하는 `<UserMenu>`만 서스펜드됩니다. 만약 레이아웃 최상단에서 `await cookies()`를 호출했다면 레이아웃 전체와 그 아래 모든 자식이 프리렌더링에서 제외되었을 것입니다.

`params`와 `searchParams`도 마찬가지입니다. 페이지 수준에서 구조 분해하지 말고, 값이 필요한 컴포넌트에 프로미스를 전달하세요.

```tsx filename="app/shop/[category]/page.tsx" switcher
import { Suspense } from 'react'
import { Hero } from './hero'
import { ProductGrid } from './product-grid'

export async function generateStaticParams() {
  const categories = await getCategories()
  return categories.map((c) => ({ category: c.slug }))
}

export default function ShopPage({
  params,
}: {
  params: Promise<{ category: string }>
}) {
  return (
    <div>
      <Hero />
      <Suspense fallback={<p>Loading products...</p>}>
        <ProductGrid paramsPromise={params} />
      </Suspense>
    </div>
  )
}
```

`<Hero />`는 정적 셸의 일부로 그려지고, `<ProductGrid>`는 카테고리 값이 필요한 시점에 `params`를 해결하면서 자기 경계 안에서만 서스펜드됩니다.

프로미스를 `.then()`으로 그 자리에서 풀어, 자식이 프로미스 대신 일반 값을 받게 할 수도 있습니다.

```tsx filename="app/shop/[category]/page.tsx" switcher
<Suspense fallback={<p>Loading products...</p>}>
  {params.then(({ category }) => (
    <ProductGrid category={category} />
  ))}
</Suspense>
```

이렇게 하면 접근 시점은 경계 안으로 미루면서도 `ProductGrid`는 `Promise`가 아니라 `string`을 받는 단순한 컴포넌트로 유지됩니다.

### `loading.js`와 `<Suspense>` 중 무엇을 쓸 것인가

|  | `loading.js` | `<Suspense>` |
| --- | --- | --- |
| **범위** | 페이지 전체 | 임의의 컴포넌트 |
| **설정** | 파일 하나 추가 | 컴포넌트를 직접 감싸기 |
| **내비게이션** | 즉시 표시되는 폴백으로 프리페치됨 | 기본적으로 프리페치되지 않음 |
| **적합한 경우** | 데이터 없이는 아무것도 렌더링할 수 없는 페이지 | 세밀한 제어가 필요한 대부분의 페이지 |

동적 접근에 가까운 곳에 명시적인 `<Suspense>` 경계를 두는 것이 좋습니다. 프리렌더러는 *가장 가까운* 경계까지만 올라가므로, 트리 위쪽의 `loading.js`도 유효한 경계가 됩니다. 프레임워크는 거기서 탐색을 멈추고, 결과적으로 세밀하게 스트리밍되는 대신 페이지 전체가 스켈레톤으로 대체됩니다.

### 스트리밍 도중의 오류 처리

스트리밍이 시작된 뒤 컴포넌트가 오류를 던지면, 가장 가까운 [`error.js`](/docs/app/api-reference/file-conventions/error) 경계가 이를 잡아 실패한 컴포넌트 자리에 오류 UI를 렌더링합니다. 페이지의 나머지는 그대로 유지되고 오류가 발생한 구역만 교체됩니다.

첫 청크와 함께 이미 `200 OK`가 전송되었기 때문에 상태 코드를 `4xx`나 `5xx`로 바꿀 수는 없습니다. 오류는 전적으로 스트리밍된 HTML 안에서 처리됩니다. [HTTP 계약](#http-계약)을 참고하세요.

## 클라이언트로 데이터 스트리밍하기

서버 컴포넌트에서 fetch를 시작하고, 아직 해결되지 않은 프로미스를 클라이언트 컴포넌트에 prop으로 전달할 수 있습니다. 프로미스는 필요한 만큼 여러 계층을 거쳐 전달될 수 있으며, React의 [`use`](https://react.dev/reference/react/use) API로 값을 읽는 컴포넌트만 `<Suspense>` 경계로 감싸면 됩니다.

```tsx filename="app/dashboard/page.tsx" switcher
import { Suspense } from 'react'
import { StatsChart } from './stats-chart'

type Stats = { revenue: number; orders: number }

async function getStats(): Promise<Stats> {
  const res = await fetch('https://api.example.com/stats')
  return res.json()
}

export default function Dashboard() {
  // 서버 렌더링 중에 fetch를 시작하되 await 하지 않습니다
  const statsPromise = getStats()

  return (
    <Suspense fallback={<p>Loading chart...</p>}>
      <StatsChart dataPromise={statsPromise} />
    </Suspense>
  )
}
```

```tsx filename="app/dashboard/stats-chart.tsx" switcher
'use client'

import { use } from 'react'

type Stats = { revenue: number; orders: number }

export function StatsChart({ dataPromise }: { dataPromise: Promise<Stats> }) {
  const stats = use(dataPromise)

  return <div>{/* stats로 차트를 렌더링 */}</div>
}
```

폴백은 정적 셸과 함께 즉시 전송됩니다. 프로미스가 해결되면 React가 완성된 HTML을 페이지 안으로 스트리밍합니다.

### 트리 전체에서 프로미스 공유하기

여러 컴포넌트가 같은 데이터를 필요로 한다면, fetch를 한 번만 시작하고 그 프로미스를 컨텍스트 프로바이더로 전달하세요. 하위 트리의 어떤 컴포넌트든 `use()`로 값을 읽을 수 있습니다.

```tsx filename="app/layout.tsx"
import { getUser } from '@/lib/data'
// 하위 트리를 위해 프로미스를 React 컨텍스트에 저장합니다
import { UserProvider } from './user-provider'

export default function Layout({ children }: { children: React.ReactNode }) {
  const userPromise = getUser()

  return <UserProvider userPromise={userPromise}>{children}</UserProvider>
}
```

전체 패턴은 [컨텍스트 프로바이더 안에서 React의 `use` 사용하기](/docs/app/guides/single-page-applications#using-reacts-use-within-a-context-provider)를 참고하세요.

## 라우트 핸들러에서의 스트리밍

위 패턴들은 React와 Suspense를 통해 UI를 스트리밍합니다. React 렌더링 바깥에서는 [라우트 핸들러](/docs/app/api-reference/file-conventions/route)가 Web Streams API로 원시 응답을 스트리밍할 수 있습니다. Server-Sent Events, 큰 파일 생성 등 데이터가 점진적으로 도착해야 하는 응답에 유용합니다.

```ts filename="app/api/stream/route.ts" switcher
export async function GET() {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      for (let i = 0; i < 10; i++) {
        controller.enqueue(encoder.encode(`Chunk ${i + 1}\n`))
        await new Promise((resolve) => setTimeout(resolve, 200))
      }
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
```

`curl http://localhost:3000/api/stream`으로 이 라우트에 접속하면 청크가 하나씩 도착하는 것을 볼 수 있습니다.

`FileHandle.readableWebStream()`을 사용하면 파일을 메모리에 전부 올리지 않고도 스트리밍할 수 있습니다.

```ts filename="app/api/download/route.ts" switcher
import { open } from 'node:fs/promises'

export async function GET() {
  const file = await open('/path/to/large-file.csv')

  return new Response(file.readableWebStream(), {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="data.csv"',
    },
  })
}
```

## 렌더링과 Web Vitals

[Web Vitals](https://web.dev/articles/vitals)는 Google이 사용자 경험을 측정하는 지표이며, 스트리밍은 그중 몇 가지에 직접 영향을 줍니다.

### TTFB와 FCP

스트리밍이 없으면 서버는 모든 데이터를 받은 뒤에야 HTML을 보내므로 TTFB가 가장 느린 쿼리와 같아집니다. 스트리밍을 사용하면 정적 셸이 준비되는 즉시 전송되므로, TTFB는 레이아웃과 폴백을 렌더링하는 데 걸리는 시간으로 줄어듭니다. 브라우저가 셸을 즉시 그리기 때문에 FCP가 데이터 가져오기 시간과 분리됩니다.

### LCP (Largest Contentful Paint)

LCP 요소(히어로 이미지, 주요 제목, 상품 사진 등)가 Suspense 경계 안에 있으면 그 경계의 콘텐츠가 교체되기 전까지 그려질 수 없습니다. 콘텐츠를 드러내는 데에는 클라이언트 비용도 듭니다. React가 경계의 HTML과 함께 작은 인라인 스크립트를 스트리밍하고, 그 스크립트가 실행되어야 콘텐츠가 나타나기 때문입니다.

경계가 LCP 요소를 지연시키는 원인이 데이터 가져오기만 있는 것은 아닙니다. 크기가 큰 경계는 HTML 전송 자체에 시간이 걸리므로 React가 보류하기도 합니다. [무엇이 Suspense 경계를 활성화하는가](https://react.dev/reference/react/Suspense#what-activates-a-suspense-boundary)를 참고하세요.

> **알아두기:** 경험칙으로, Suspense 경계가 있으면 React는 그것을 사용할 수 있습니다. 네트워크가 느리거나 CPU가 바쁠 때는 예상하지 못한 상황에서도 동시성 렌더링이 폴백으로 되돌아갈 수 있습니다. 경계를 추가한다는 것은 그 가능성을 받아들인다는 뜻이므로, 필요하지 않은 경계는 두지 마세요.

LCP를 빠르게 유지하려면 다음을 지키세요.

* LCP 요소는 Suspense 경계 **바깥**이나 **위쪽**에 두어 정적 셸의 일부로 렌더링되게 합니다.
* LCP 이미지에는 `next/image`의 [`preload`](/docs/app/api-reference/components/image#preload) prop을 사용합니다. `<head>`에 `<link rel="preload">`를 삽입하므로, `<img>` 태그가 HTML에 나타나기도 전인 첫 청크부터 브라우저가 이미지를 받기 시작합니다. 다만 이것은 이미지를 언제 *가져올지*를 제어할 뿐 언제 그려질지를 제어하지는 않습니다. 경계 안의 이미지는 여전히 교체를 기다립니다.
* 이미지가 아닌 LCP 요소(텍스트, 제목)는 Suspense 경계 바깥에 렌더링합니다.

### CLS (Cumulative Layout Shift)

폴백이 해결된 콘텐츠로 교체되면 브라우저가 레이아웃을 다시 계산합니다. 둘의 크기가 다르면 주변 레이아웃이 밀립니다. CLS를 줄이려면 스켈레톤을 실제 콘텐츠와 **같은 크기**로 설계하고, 경계 주위에 고정 높이나 최소 높이 컨테이너를 두어 콘텐츠가 도착하기 전에 공간을 확보하세요.

### INP (Interaction to Next Paint)

스트리밍은 [선택적 하이드레이션](https://react.dev/reference/react-dom/client/hydrateRoot)을 가능하게 합니다. React는 스트리밍되어 들어오는 컴포넌트를 독립적으로 하이드레이션하며, 사용자가 상호작용 중인 부분을 우선합니다. **각 `<Suspense>` 경계가 하나의 하이드레이션 단위입니다.** 경계가 없으면 React는 페이지 전체를 한 번의 블로킹 작업으로 하이드레이션하지만, 경계가 있으면 하이드레이션이 브라우저에 제어권을 양보하는 작은 작업들로 쪼개져 메인 스레드가 계속 반응할 수 있습니다.

### 이른 리소스 발견

정적 셸에는 `<link>`와 `<script>` 태그가 첫 HTML 청크부터 포함됩니다. 따라서 서버가 아직 콘텐츠를 생성하는 동안 브라우저는 CSS, JavaScript, 폰트를 발견해 내려받기 시작합니다. 리소스를 서버 처리 시간 *이후*가 아니라 그 *도중에* 가져오는 것입니다.

앞의 대시보드 예시에서는 `<h1>`이 셸에서 렌더링되고(LCP에 유리), 각 데이터 구역이 자기 경계 뒤에서 스트리밍되며(하이드레이션이 나뉘므로 INP에 유리), 스켈레톤 폴백이 공간을 확보합니다(CLS에 유리).

## HTTP 계약

스트리밍이 시작되면 상태 코드를 포함한 응답 헤더는 이미 전송된 상태입니다. **스트리밍이 시작된 뒤에는 상태 코드와 헤더를 바꿀 수 없습니다.** 이 절의 내용은 모두 이 한 가지 제약에서 비롯됩니다.

### 상태 코드

Suspense 폴백이 렌더링되거나 컴포넌트가 서스펜드되면, 서버는 HTML 스트림을 보내기 위해 `200 OK`를 확정해야 합니다. 스트리밍 도중에 [`notFound()`](/docs/app/api-reference/functions/not-found)가 호출되어도 Next.js는 상태 코드를 404로 되돌릴 수 없습니다. 대신 검색 엔진이 해당 페이지를 색인하지 않도록 스트리밍되는 HTML에 `<meta name="robots" content="noindex">`를 삽입합니다. 마찬가지로 스트리밍 도중의 [`redirect()`](/docs/app/api-reference/functions/redirect)는 HTTP 리다이렉트 헤더가 아니라 클라이언트 사이드 리다이렉트가 됩니다.

### 스트리밍은 언제 시작되는가

응답 본문은 Suspense 폴백이 렌더링될 때(예: `loading.tsx`) 또는 경계 아래의 컴포넌트가 서스펜드될 때 스트리밍되기 시작합니다. 오류에 대해 실제 HTTP 상태 코드를 받으려면 `notFound()`를 어떤 `await`나 Suspense 경계보다 **앞에** 호출하세요.

```tsx filename="app/post/[slug]/page.tsx" switcher
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { PostContent } from './post-content'

export async function generateStaticParams() {
  const posts = await getPublishedPosts()
  return posts.map((post) => ({ slug: post.slug }))
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const exists = await checkSlugExists(slug) // 빠른 존재 확인
  if (!exists) notFound() // Suspense 경계 이전이므로 실제 404

  return (
    <Suspense fallback={<p>Loading post...</p>}>
      <PostContent slug={slug} />
    </Suspense>
  )
}
```

> **알아두기:** [`proxy`](/docs/app/api-reference/file-conventions/proxy)(리다이렉트, 리라이트, 응답 반환)나 [`next.config.js`의 redirects](/docs/app/api-reference/config/next-config-js/redirects)로 요청을 미리 차단할 수도 있습니다. 둘 다 페이지 렌더링 전에 실행되므로 HTTP 상태 코드를 그대로 사용할 수 있습니다.

### 봇과 크롤러

HTML만 처리하는 봇과 크롤러는 최초 HTML의 `<head>`에 메타데이터가 있어야 합니다. Next.js는 user agent로 이들을 식별해, [`generateMetadata`](/docs/app/api-reference/functions/generate-metadata)가 완료될 때까지 기다린 뒤 페이지 콘텐츠를 스트리밍합니다. 일반 브라우저와 DOM을 처리할 수 있는 크롤러는 대신 [스트리밍 메타데이터](/docs/app/api-reference/functions/generate-metadata#streaming-metadata)를 페이지 콘텐츠와 함께 받습니다. 어떤 봇이 블로킹 메타데이터를 받을지는 [`htmlLimitedBots`](/docs/app/api-reference/config/next-config-js/htmlLimitedBots) 옵션으로 설정할 수 있습니다.

[Cache Components](/docs/app/getting-started/caching)를 사용하면 방문자와 DOM 처리가 가능한 크롤러는 프리렌더링된 셸을 즉시 받고 동적 콘텐츠는 뒤이어 스트리밍되지만, HTML만 처리하는 봇은 **프리렌더링된 셸을 건너뛰고** 페이지를 동적으로 렌더링합니다. 메타데이터를 `<head>`에 넣어야 하기 때문입니다.

여기에는 기억해 둘 만한 실질적인 결과가 따라옵니다. 셸이 프리렌더링 중에만 존재하는 입력값, 예컨대 빌드 시점 데이터나 요청 시점 환경에서는 접근할 수 없는 값에 의존한다면, 사람에게는 잘 열리는 페이지가 크롤러에게는 렌더링에 실패할 수 있습니다. 봇은 그 코드를 요청 시점에 다시 실행하기 때문입니다. 셸이 의존하는 데이터가 요청 시점에도 사용 가능한지 확인하세요.

## 스트리밍에 영향을 주는 요소

서버와 클라이언트 사이에서 응답을 버퍼링하는 계층이 있으면 스트리밍의 이점이 줄어듭니다. HTML이 서버에서 점진적으로 생성되더라도, 프록시나 CDN 또는 클라이언트가 모든 청크를 모은 뒤에 렌더링한다면 사용자에게는 그저 늦게 도착한 하나의 응답으로 보입니다.

| 계층 | 확인할 점 |
| --- | --- |
| **리버스 프록시** | Nginx 등은 기본적으로 버퍼링합니다. `X-Accel-Buffering: no` 헤더를 보내 비활성화하세요. |
| **CDN** | 응답 전체를 모은 뒤 전달하는 경우가 있습니다. 청크 응답이 그대로 통과하는지, 어떤 요금제에서 지원되는지 확인하세요. |
| **서버리스 플랫폼** | 모두가 스트리밍을 지원하지는 않습니다. AWS Lambda는 응답 스트리밍 모드를 명시적으로 켜야 하며, Vercel은 기본 지원합니다. |
| **압축** | Gzip과 Brotli는 내부적으로 버퍼링한 뒤 내보내므로 첫 청크가 늦어질 수 있습니다. |
| **클라이언트** | Safari/WebKit은 1024바이트가 도착할 때까지 버퍼링하므로 아주 작은 응답은 한 번에 그려집니다. `curl`도 버퍼링하며, `-N`으로 끌 수 있지만 여전히 줄바꿈 단위로 출력합니다. |

`X-Accel-Buffering` 헤더는 설정 파일에서 전역으로 지정할 수 있습니다.

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

### 스트리밍이 동작하는지 확인하기

**네트워크 탭 확인.** Chrome DevTools에서 document 요청을 선택하고 Timing 항목을 보세요. "Time to First Byte"가 이르고 "Content Download" 구간이 길다면 응답이 한 번에 오지 않고 스트리밍되고 있다는 뜻입니다.

**원시 청크 관찰.** 응답을 스트림으로 읽는 편이 자체 버퍼링이 있는 `curl`보다 정확합니다.

```js filename="stream-observer.mjs"
const res = await fetch('http://localhost:3000/dashboard', {
  headers: { 'Accept-Encoding': 'identity' },
})

const reader = res.body.getReader()
const decoder = new TextDecoder()
let i = 0
const start = Date.now()

while (true) {
  const { done, value } = await reader.read()
  if (done) break
  console.log(`\nchunk ${i++} (+${Date.now() - start}ms)\n`)
  console.log(decoder.decode(value))
}
```

형제 경계가 두 개인 페이지라면 출력은 다음과 같습니다.

```text filename="Terminal"
chunk 0 (+0ms)    # 정적 셸: <head>, CSS, 내비게이션, 폴백 스켈레톤,
                  # <template id="B:0"> 및 <template id="B:1"> 자리표시자,
                  # 부트스트랩 스크립트
chunk 1 (+170ms)  # 하이드레이션용 컴포넌트 페이로드(self.__next_f.push)
chunk 2 (+1000ms) # 첫 번째 경계: 페이로드 + <div hidden id="S:0"> (B:0을 교체)
chunk 3 (+3000ms) # 두 번째 경계: 페이로드 + <div hidden id="S:1"> (B:1을 교체)
```

`<template id="B:0">` 표시는 Suspense 폴백 자리표시자입니다. 경계가 해결되면 React는 완성된 HTML을 담은 `<div hidden id="S:0">`과 그것을 페이지에 끼워 넣는 스크립트를 스트리밍합니다. 타임스탬프는 각 경계가 독립적으로 해결되는 것을 보여줍니다.

> **알아두기:** `Accept-Encoding: identity` 헤더는 압축을 비활성화해 압축 계층이 청크를 버퍼링하지 않게 합니다.

**봇 요청과 비교.** 같은 스크립트에 `'User-Agent': 'Twitterbot/1.0'`을 추가하면 `await fetch()` 자체가 전체 렌더링이 끝날 때까지 블로킹되고, 본문은 한 번에 도착하며 위와 같은 시차가 사라집니다. 앞에서 설명한 [봇과 크롤러](#봇과-크롤러) 동작을 직접 확인할 수 있습니다.

### 플랫폼 지원

| 배포 방식 | 스트리밍 지원 |
| --- | --- |
| Node.js 서버 | 지원 |
| Docker 컨테이너 | 지원 |
| 정적 내보내기(Static export) | 미지원 |
| 어댑터 | 플랫폼별로 다름 |

## 인프라 측면의 의미

컴포넌트 단위 렌더링 모델은 애플리케이션을 호스팅하는 환경에 직접적인 요구사항을 만듭니다.

* **스트리밍**이 필요합니다. 정적 콘텐츠와 동적 콘텐츠가 하나의 응답으로 전달되기 때문입니다.
* 인스턴스가 여러 개일 때는 **캐시 조율**이 필요합니다. 캐시된 콘텐츠는 `revalidateTag()`나 `revalidatePath()`로 언제든 무효화될 수 있기 때문입니다.
* **캐시 일관성**이 중요합니다. 재검증은 HTML과 RSC 페이로드를 함께 다시 생성하는데, 둘이 어긋나면 사용자가 내비게이션 중에 서로 다른 데이터를 볼 수 있습니다.
* **CDN 지연 시간으로 PPR 셸 전달하기**에는 추가적인 플랫폼 통합이 필요할 수 있습니다. 정적 셸을 별도로 저장하고 동적 렌더링을 올바르게 재개해야 하기 때문입니다.

문서는 플랫폼 지원을 두 수준으로 구분합니다. **기능적 충실도(functional fidelity)** 는 모든 기능이 올바르게 동작한다는 뜻으로, 통과냐 아니냐의 이분법이며 [어댑터 테스트 스위트](/docs/app/api-reference/adapters/testing-adapters)가 그 기준입니다. **성능적 충실도(performance fidelity)** 는 기능이 최적의 성능 특성에 도달한다는 뜻으로(PPR 셸이 원본 서버가 아니라 CDN 지연 시간으로 제공되거나, ISR이 1초 이내로 전파되는 등), 스펙트럼이며 플랫폼 간 차별화 지점입니다. 기능적 충실도를 만족하는 플랫폼은 완전히 지원되는 배포 대상입니다.

## 정리

동적 렌더링을 촉발하는 것은 결국 **코드 자체**입니다. 비동기 작업, 결정적이지 않은 출력, 런타임 데이터가 그것입니다. 프레임워크는 이런 것을 만나면 폴백으로 쓸 `<Suspense>` 경계를 찾아 트리 위로 올라갑니다. 그 경계들보다 위에 있는 모든 것이 정적 셸이 되어 즉시 전송되고, 각 경계는 해결되는 대로 결과가 페이지 안으로 스트리밍됩니다.

따라서 렌더링을 결정짓는 선택은 두 가지입니다. **무엇을 캐시할 것인가**와 **경계를 어디에 둘 것인가**. 캐시할 수 있는 것은 `use cache`로 캐시해 정적 셸을 키우고, 동적 접근은 실제로 필요한 컴포넌트까지 내린 뒤 그 컴포넌트를 `<Suspense>`로 감싸세요. 나머지는 모두 셸이 됩니다.

## 더 읽어볼 자료

* [Rendering Philosophy](/docs/app/guides/rendering-philosophy) — 정적과 동적의 스펙트럼, 그리고 그 트레이드오프
* [Streaming](/docs/app/guides/streaming) — 이 노트가 요약한 전체 가이드
* [Caching](/docs/app/getting-started/caching) — `use cache`, `cacheLife`, 프리렌더링과 프리페칭
* [Glossary](/docs/app/glossary) — 프리렌더링, 동적 렌더링, 정적 셸, App Shell, PPR, 하이드레이션, RSC 페이로드
* [RSC Explorer](https://rscexplorer.dev/) — 컴포넌트 페이로드 형식을 살펴볼 수 있는 인터랙티브 도구
* [청크 전송 인코딩 (MDN)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Transfer-Encoding) — 스트리밍을 가능하게 하는 HTTP/1.1 메커니즘
* [하이드레이션 전 깜빡임 방지](/docs/app/guides/preventing-flash-before-hydration) — 브라우저가 그리기 전에 서버 렌더링 HTML을 클라이언트별 값으로 갱신하는 방법
