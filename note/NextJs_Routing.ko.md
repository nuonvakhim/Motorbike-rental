# 라우팅

단순한 폴더와 `page` 파일 외에도, App Router에는 세그먼트가 URL에 대응되는 *방식*을 바꾸는 네 가지 폴더 규칙이 있습니다. 동적 세그먼트, 라우트 그룹, 병렬 라우트, 인터셉팅 라우트입니다. 이 문서에서는 각각을 살펴봅니다.

| 규칙 | 폴더 | URL에 미치는 영향 |
| ---- | ---- | ----------------- |
| 동적 세그먼트 | `[slug]` | 세그먼트 하나를 파라미터로 캡처 |
| Catch-all 세그먼트 | `[...slug]` | 하나 *이상*의 세그먼트를 캡처 |
| 선택적 catch-all | `[[...slug]]` | 0개 이상의 세그먼트를 캡처 |
| 라우트 그룹 | `(group)` | 없음 — 구성 목적 전용 |
| 병렬 라우트 슬롯 | `@slot` | 없음 — 레이아웃의 prop으로 렌더링됨 |
| 인터셉팅 라우트 | `(.)segment` | 가로챈 URL을 가림 |

## 동적 라우트 세그먼트

URL 경로는 경로 세그먼트의 나열입니다. 세그먼트는 **정적**(정확히 일치하는 리터럴 값)이거나 **동적**(URL에서 값을 캡처하는 자리 표시자)일 수 있습니다. 세그먼트의 값을 미리 알 수 없을 때 동적 세그먼트를 정의하면 동적 데이터로부터 라우트를 만들 수 있습니다. Next.js는 캡처한 값을 `params` prop을 통해 페이지에 전달하며, 이 값은 요청 시점에 채워지거나 빌드 시점에 미리 렌더링됩니다.

> **알아두기**: 동적 세그먼트는 흔히 path params, route params, URL params라고도 부릅니다.

### 규칙

폴더 이름을 대괄호로 감싸면 동적 세그먼트가 만들어집니다: `[folderName]`.

```tsx
app/
└── blog/
    └── [slug]/
        └── page.tsx      // 라우트: /blog/:slug
```

```tsx filename="app/blog/[slug]/page.tsx" switcher
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  return <div>My Post: {slug}</div>
}
```

동적 세그먼트는 [`layout`](/docs/app/api-reference/file-conventions/layout), [`page`](/docs/app/api-reference/file-conventions/page), [`generateMetadata`](/docs/app/api-reference/functions/generate-metadata#generatemetadata-function) 함수에 `params` prop으로 전달됩니다.

| 라우트 | 예시 URL | `params` |
| ------ | -------- | -------- |
| `app/blog/[slug]/page.js` | `/blog/a` | `{ slug: 'a' }` |
| `app/blog/[slug]/page.js` | `/blog/b` | `{ slug: 'b' }` |
| `app/blog/[slug]/page.js` | `/blog/c` | `{ slug: 'c' }` |

[루트 레이아웃](/docs/app/api-reference/file-conventions/layout#root-layout)보다 앞에 오는 동적 세그먼트는 **루트 파라미터**이며, [`next/root-params`](/docs/app/api-reference/functions/next-root-params)를 사용해 어떤 서버 컴포넌트에서든 추가로 읽을 수 있습니다.

### 클라이언트 컴포넌트에서

클라이언트 컴포넌트 **페이지**에서는 [`use`](https://react.dev/reference/react/use) API로 props의 동적 세그먼트에 접근할 수 있습니다.

```tsx filename="app/blog/[slug]/page.tsx" switcher
'use client'
import { use } from 'react'

export default function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = use(params)

  return (
    <div>
      <p>{slug}</p>
    </div>
  )
}
```

또는 클라이언트 컴포넌트 트리 어디에서든 [`useParams`](/docs/app/api-reference/functions/use-params) 훅으로 `params`에 접근할 수 있습니다.

### Catch-all 세그먼트

대괄호 안에 말줄임표를 추가하면(`[...folderName]`) 동적 세그먼트를 확장해 뒤따르는 세그먼트를 모두 **캡처**할 수 있습니다.

```tsx
app/
└── shop/
    └── [...slug]/
        └── page.tsx      // /shop/a, /shop/a/b, /shop/a/b/c ... 에 매칭
```

| 라우트 | 예시 URL | `params` |
| ------ | -------- | -------- |
| `app/shop/[...slug]/page.js` | `/shop/a` | `{ slug: ['a'] }` |
| `app/shop/[...slug]/page.js` | `/shop/a/b` | `{ slug: ['a', 'b'] }` |
| `app/shop/[...slug]/page.js` | `/shop/a/b/c` | `{ slug: ['a', 'b', 'c'] }` |

### 선택적 catch-all 세그먼트

파라미터를 이중 대괄호로 감싸면(`[[...folderName]]`) catch-all 세그먼트를 **선택적**으로 만들 수 있습니다.

**catch-all**과 **선택적 catch-all**의 차이는, 선택적일 경우 파라미터가 없는 라우트도 함께 매칭된다는 점입니다(아래 예시의 `/shop`).

| 라우트 | 예시 URL | `params` |
| ------ | -------- | -------- |
| `app/shop/[[...slug]]/page.js` | `/shop` | `{ slug: undefined }` |
| `app/shop/[[...slug]]/page.js` | `/shop/a` | `{ slug: ['a'] }` |
| `app/shop/[[...slug]]/page.js` | `/shop/a/b` | `{ slug: ['a', 'b'] }` |
| `app/shop/[[...slug]]/page.js` | `/shop/a/b/c` | `{ slug: ['a', 'b', 'c'] }` |

### TypeScript

TypeScript를 사용할 때는 설정한 라우트 세그먼트에 맞춰 `params`에 타입을 지정할 수 있습니다. `page`와 `layout`의 `params` 타입은 각각 [`PageProps<'/route'>`](/docs/app/api-reference/file-conventions/page#page-props-helper)와 [`LayoutProps<'/route'>`](/docs/app/api-reference/file-conventions/layout#layout-props-helper)를 사용하세요.

라우트 `params` 값은 `string`, `string[]`, 또는 `undefined`(선택적 catch-all 세그먼트의 경우)로 타입이 지정됩니다. 런타임 전까지는 값을 알 수 없기 때문입니다. 사용자는 주소창에 어떤 URL이든 입력할 수 있으므로, 이렇게 넓은 타입을 쓰면 애플리케이션 코드가 모든 경우를 처리하도록 보장하는 데 도움이 됩니다.

| 라우트 | `params` 타입 정의 |
| ------ | ------------------ |
| `app/blog/[slug]/page.js` | `{ slug: string }` |
| `app/shop/[...slug]/page.js` | `{ slug: string[] }` |
| `app/shop/[[...slug]]/page.js` | `{ slug?: string[] }` |
| `app/[categoryId]/[itemId]/page.js` | `{ categoryId: string, itemId: string }` |

알려진 언어 코드 집합을 갖는 `[locale]` 파라미터처럼, `params`가 정해진 개수의 유효한 값만 가질 수 있는 라우트를 다룰 때는 런타임 검증으로 사용자가 입력할 수 있는 잘못된 파라미터를 처리하고, 애플리케이션의 나머지 부분은 알려진 집합에서 좁혀진 타입으로 동작하게 할 수 있습니다.

```tsx filename="app/[locale]/page.tsx"
import { notFound } from 'next/navigation'
import type { Locale } from '@i18n/types'
import { isValidLocale } from '@i18n/utils'

function assertValidLocale(value: string): asserts value is Locale {
  if (!isValidLocale(value)) notFound()
}

export default async function Page(props: PageProps<'/[locale]'>) {
  const { locale } = await props.params // locale의 타입은 string
  assertValidLocale(locale)
  // 이제 locale의 타입은 Locale
}
```

### 동작 방식

* `params` prop은 Promise이므로 값에 접근하려면 `async`/`await`나 React의 `use` 함수를 사용해야 합니다.
  * 버전 14 이하에서 `params`는 동기 prop이었습니다. 하위 호환을 위해 Next.js 15에서도 여전히 동기적으로 접근할 수 있지만, 이 동작은 앞으로 폐기될 예정입니다.

### `generateStaticParams`로 프리렌더링하기

[`generateStaticParams`](/docs/app/api-reference/functions/generate-static-params) 함수를 사용하면 요청 시점에 그때그때 생성하는 대신 빌드 시점에 라우트를 [정적으로 생성](/docs/app/glossary#prerendering)할 수 있습니다.

```tsx filename="app/blog/[slug]/page.tsx" switcher
export async function generateStaticParams() {
  const posts = await fetch('https://.../posts').then((res) => res.json())

  return posts.map((post) => ({
    slug: post.slug,
  }))
}
```

`generateStaticParams` 함수 안에서 `fetch`를 사용하면 요청이 [자동으로 중복 제거](/docs/app/glossary#memoization)됩니다. 덕분에 레이아웃, 페이지, 다른 `generateStaticParams` 함수에서 같은 데이터를 여러 번 네트워크로 호출하는 일을 피하고 빌드 시간을 단축할 수 있습니다.

[Cache Components](/docs/app/getting-started/caching)를 활성화하면 두 경우가 달라집니다.

* **`generateStaticParams`가 없을 때** — 프리렌더링 중에는 파라미터 값을 알 수 없으므로 params는 런타임 데이터입니다. 폴백 UI를 제공하려면 params 접근을 `<Suspense>` 경계로 감싸세요. 레이아웃에서는 최상위에서 `params`를 await 하지 마세요. Promise를 아래로 내려보내 필요한 컴포넌트에서 await 해야 하며, 그렇지 않으면 레이아웃을 프리렌더링할 수 없습니다.
* **`generateStaticParams`가 있을 때** — 샘플 파라미터가 빌드 시점에 실행되어 정적 HTML을 생성합니다. 빌드 시점 검증은 그 샘플이 도달하는 코드 경로만 확인하므로, 다른 파라미터 값에서 런타임 API(예: `cookies()`)를 호출하는 조건 분기는 여전히 자체 `<Suspense>` 경계가 필요합니다.

## 라우트 그룹

라우트 그룹은 라우트를 카테고리나 팀별로 정리할 수 있게 해주는 폴더 규칙입니다.

### 규칙

폴더 이름을 소괄호로 감싸면 라우트 그룹이 만들어집니다: `(folderName)`. 이 규칙은 해당 폴더가 구성 목적이며 라우트의 URL 경로에 **포함되지 않아야 함**을 나타냅니다.

```tsx
app/
├── (marketing)/
│   ├── layout.tsx        // 마케팅 섹션 전용 레이아웃
│   ├── about/
│   │   └── page.tsx      // 라우트: /about     ("(marketing)"은 URL에 없음)
│   └── blog/
│       └── page.tsx      // 라우트: /blog
└── (shop)/
    ├── layout.tsx        // 쇼핑 섹션 전용 레이아웃
    ├── account/
    │   └── page.tsx      // 라우트: /account
    └── cart/
        └── page.tsx      // 라우트: /cart
```

### 사용 사례

* 팀, 관심사, 기능 단위로 라우트를 정리할 때.
* 여러 개의 [루트 레이아웃](/docs/app/api-reference/file-conventions/layout#root-layout)을 정의할 때.
* 특정 라우트 세그먼트만 레이아웃을 공유하게 하고 나머지는 제외할 때.

### 주의사항

* **전체 페이지 로드**: 서로 다른 루트 레이아웃을 사용하는 라우트 사이를 이동하면 전체 페이지가 새로고침됩니다. 예를 들어 `app/(shop)/layout.js`를 쓰는 `/cart`에서 `app/(marketing)/layout.js`를 쓰는 `/blog`로 이동하는 경우입니다. 이는 루트 레이아웃이 여러 개일 때**만** 해당됩니다.
* **경로 충돌**: 서로 다른 그룹의 라우트가 같은 URL 경로로 해석되면 안 됩니다. 예를 들어 `(marketing)/about/page.js`와 `(shop)/about/page.js`는 둘 다 `/about`으로 해석되어 오류가 발생합니다.
* **최상위 루트 레이아웃**: 최상위 `layout.js` 파일 없이 여러 루트 레이아웃을 사용한다면, 홈 라우트(`/`)가 라우트 그룹 중 하나 안에 정의되어 있는지 확인하세요(예: `app/(marketing)/page.js`).

## 병렬 라우트

병렬 라우트는 같은 레이아웃 안에서 둘 이상의 페이지를 동시에 렌더링하며, 각각 독립적으로 내비게이션됩니다. 대시보드나 피드에 사용합니다. 지금 당장 필요할 가능성은 낮으며, 여기서의 목표는 `@folder` 규칙을 보았을 때 알아볼 수 있게 하는 것입니다.

슬롯은 `@folder` 형태로 이름 붙인 폴더입니다. 라우트 세그먼트가 **아니므로** URL에 나타나지 않습니다.

```tsx
app/
├── layout.tsx            // `children`, `team`, `analytics` prop을 받음
├── page.tsx              // 암묵적인 `children` 슬롯
├── @analytics/
│   └── page.tsx          // 슬롯 — 라우트 세그먼트가 아님
└── @team/
    └── page.tsx          // 슬롯 — 라우트 세그먼트가 아님
```

각 슬롯은 `children`과 함께 공유 레이아웃에 각자의 prop으로 전달됩니다.

```tsx filename="app/layout.tsx"
export default function Layout({ children, team, analytics }) {
  return (
    <>
      {children}
      {team}
      {analytics}
    </>
  )
}
```

기억해 둘 세 가지는 다음과 같습니다.

* `children` 자체가 암묵적인 슬롯입니다 — `app/page.js`는 `app/@children/page.js`와 같습니다.
* 클라이언트 사이드 내비게이션에서는 매칭되지 않은 슬롯이 현재 하위 페이지를 그대로 유지합니다. 새로고침 시에는 Next.js가 해당 슬롯의 `default.js`를 렌더링하며, 없으면 `404`를 렌더링합니다.
* 같은 세그먼트 레벨의 슬롯은 전부 프리렌더링되거나 전부 동적이어야 합니다 — 둘을 섞을 수 없습니다.

탭 그룹, 역할 기반 조건부 슬롯, 슬롯별 로딩·에러 UI가 필요해지면 [병렬 라우트](/docs/app/api-reference/file-conventions/parallel-routes) 문서를 참고하세요.

## 인터셉팅 라우트

인터셉팅 라우트는 앱의 다른 곳에 있는 라우트를 *현재 레이아웃 안에서* 불러오면서 URL을 가립니다. 대표적인 예는 피드에서 사진을 클릭하면 피드 위에 모달로 열리고, 같은 URL을 직접 열면 사진 전체 페이지가 렌더링되는 경우입니다.

```
소프트 내비게이션 (/feed 안에서 클릭)
  /feed  ──클릭──▶  URL은 /photo/123 으로 표시  →  피드 위에 모달

하드 내비게이션 (공유 링크, 새로고침, 주소창)
  /photo/123  ──────▶  photo/[id]/page.tsx  →  전체 페이지, 모달 없음
```

규칙은 `(..)`이며, `../`처럼 읽히지만 폴더가 아니라 **라우트 세그먼트**를 기준으로 셉니다.

* `(.)` — 같은 레벨
* `(..)` — 한 단계 위
* `(..)(..)` — 두 단계 위
* `(...)` — 루트 `app` 디렉터리 기준

```tsx
app/
├── feed/
│   ├── page.tsx                  // 라우트: /feed
│   └── (..)photo/
│       └── [id]/
│           └── page.tsx          // /feed에서 이동할 때 /photo/:id 를 가로챔
└── photo/
    └── [id]/
        └── page.tsx              // 라우트: /photo/:id — 직접 방문 또는 새로고침
```

인터셉팅 라우트는 새로고침에도 유지되고 뒤로 가기로 닫히는 모달을 만들기 위해 병렬 라우트와 함께 쓰이는 경우가 가장 많습니다. 그런 기능이 필요해지면 [인터셉팅 라우트](/docs/app/api-reference/file-conventions/intercepting-routes) 문서를 참고하세요.


---
