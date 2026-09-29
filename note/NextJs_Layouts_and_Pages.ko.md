# 레이아웃과 페이지

Next.js는 **파일 시스템 기반 라우팅**을 사용합니다. 즉, 폴더와 파일로 라우트를 정의할 수 있습니다. 이 문서에서는 레이아웃과 페이지를 만드는 방법, 그리고 그 사이를 이동하는 방법을 안내합니다.

## 페이지 만들기

**페이지**는 특정 라우트에서 렌더링되는 UI입니다. 페이지를 만들려면 `app` 디렉터리 안에 [`page` 파일](/docs/app/api-reference/file-conventions/page)을 추가하고 React 컴포넌트를 default export 하면 됩니다. 예를 들어 인덱스 페이지(`/`)를 만들려면 다음과 같이 합니다.

```tsx
app/
└── page.tsx          // 라우트: /
```

```tsx filename="app/page.tsx" switcher
export default function Page() {
  return <h1>Hello Next.js!</h1>;
}
```

```jsx filename="app/page.js" switcher
export default function Page() {
  return <h1>Hello Next.js!</h1>;
}
```

## 레이아웃 만들기

레이아웃은 여러 페이지가 **공유하는** UI입니다. 내비게이션이 일어나도 레이아웃은 상태를 보존하고, 상호작용을 유지하며, 다시 렌더링되지 않습니다.

[`layout` 파일](/docs/app/api-reference/file-conventions/layout)에서 React 컴포넌트를 default export 하면 레이아웃을 정의할 수 있습니다. 이 컴포넌트는 `children` prop을 받아야 하며, 그 자리에는 페이지나 또 다른 [레이아웃](#레이아웃-중첩하기)이 들어옵니다.

예를 들어 인덱스 페이지를 자식으로 받는 레이아웃을 만들려면 `app` 디렉터리 안에 `layout` 파일을 추가합니다.

```tsx
app/
├── layout.tsx        // 루트 레이아웃 — 모든 페이지를 감쌈
└── page.tsx          // 라우트: /
```

```tsx filename="app/layout.tsx" switcher
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {/* 레이아웃 UI */}
        {/* 페이지나 중첩 레이아웃을 렌더링할 위치에 children을 배치합니다 */}
        <main>{children}</main>
      </body>
    </html>
  );
}
```

위 레이아웃은 `app` 디렉터리의 최상위에 정의되어 있으므로 [루트 레이아웃](/docs/app/api-reference/file-conventions/layout#root-layout)이라고 부릅니다. 루트 레이아웃은 **필수**이며 반드시 `html`과 `body` 태그를 포함해야 합니다.

## 중첩 라우트 만들기

중첩 라우트는 여러 URL 세그먼트로 구성된 라우트입니다. 예를 들어 `/blog/[slug]` 라우트는 세 개의 세그먼트로 이루어집니다.

- `/` (루트 세그먼트)
- `blog` (세그먼트)
- `[slug]` (리프 세그먼트)

Next.js에서는 다음과 같습니다.

- **폴더**는 URL 세그먼트에 대응하는 라우트 세그먼트를 정의하는 데 사용합니다.
- **파일**(`page`, `layout` 등)은 해당 세그먼트에서 보여줄 UI를 만드는 데 사용합니다.

중첩 라우트를 만들려면 폴더를 서로 중첩하면 됩니다. 예를 들어 `/blog` 라우트를 추가하려면 `app` 디렉터리에 `blog` 폴더를 만듭니다. 그 다음 `/blog`를 외부에 공개하려면 `page.tsx` 파일을 추가합니다.

```tsx
app/
├── layout.tsx        // 루트 레이아웃
├── page.tsx          // 라우트: /
└── blog/
    └── page.tsx      // 라우트: /blog
```

```tsx filename="app/blog/page.tsx" switcher
// 예시용 import
import { getPosts } from "@/lib/posts";
import { Post } from "@/ui/post";

export default async function Page() {
  const posts = await getPosts();

  return (
    <ul>
      {posts.map((post) => (
        <Post key={post.id} post={post} />
      ))}
    </ul>
  );
}
```

폴더를 계속 중첩해 중첩 라우트를 만들 수 있습니다. 예를 들어 특정 블로그 글의 라우트를 만들려면 `blog` 안에 `[slug]` 폴더를 새로 만들고 `page` 파일을 추가합니다.

```tsx
app/
├── layout.tsx            // 루트 레이아웃
├── page.tsx              // 라우트: /
└── blog/
    ├── page.tsx          // 라우트: /blog
    └── [slug]/
        └── page.tsx      // 라우트: /blog/[slug]
```

```tsx filename="app/blog/[slug]/page.tsx" switcher
export function generateStaticParams() {}

export default function Page() {
  return <h1>Hello, Blog Post Page!</h1>;
}
```

폴더 이름을 대괄호로 감싸면(예: `[slug]`) [동적 라우트 세그먼트](/docs/app/api-reference/file-conventions/dynamic-routes)가 만들어지며, 데이터로부터 여러 페이지를 생성할 때 사용합니다. 블로그 글, 상품 페이지 등이 대표적입니다.

## 레이아웃 중첩하기

기본적으로 폴더 계층 구조의 레이아웃도 함께 중첩됩니다. 즉, 부모 레이아웃이 `children` prop을 통해 자식 레이아웃을 감쌉니다. 특정 라우트 세그먼트(폴더) 안에 `layout`을 추가하면 레이아웃을 중첩할 수 있습니다.

예를 들어 `/blog` 라우트용 레이아웃을 만들려면 `blog` 폴더 안에 새 `layout` 파일을 추가합니다.

```tsx
app/
├── layout.tsx            // 루트 레이아웃 — 아래의 모든 것을 감쌈
├── page.tsx              // 라우트: /
└── blog/
    ├── layout.tsx        // 블로그 레이아웃 — 루트 레이아웃 안에 중첩됨
    ├── page.tsx          // 라우트: /blog
    └── [slug]/
        └── page.tsx      // 라우트: /blog/[slug]
```

```tsx filename="app/blog/layout.tsx" switcher
export default function BlogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <section>{children}</section>;
}
```

위의 두 레이아웃을 합치면, 루트 레이아웃(`app/layout.js`)이 블로그 레이아웃(`app/blog/layout.js`)을 감싸고, 블로그 레이아웃이 다시 블로그 페이지(`app/blog/page.js`)와 블로그 글 페이지(`app/blog/[slug]/page.js`)를 감싸게 됩니다.

## 동적 세그먼트 만들기

[동적 세그먼트](/docs/app/api-reference/file-conventions/dynamic-routes)를 사용하면 데이터로부터 생성되는 라우트를 만들 수 있습니다. 예를 들어 블로그 글마다 라우트를 직접 만드는 대신, 동적 세그먼트를 만들어 블로그 글 데이터를 기반으로 라우트를 생성할 수 있습니다.

동적 세그먼트를 만들려면 세그먼트(폴더) 이름을 대괄호로 감싸면 됩니다: `[segmentName]`. 예를 들어 `app/blog/[slug]/page.tsx` 라우트에서 `[slug]`가 동적 세그먼트입니다.

```tsx filename="app/blog/[slug]/page.tsx" switcher
export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPost(slug);

  return (
    <div>
      <h1>{post.title}</h1>
      <p>{post.content}</p>
    </div>
  );
}
```

[동적 세그먼트](/docs/app/api-reference/file-conventions/dynamic-routes)와 [`params`](/docs/app/api-reference/file-conventions/page#params-optional) prop에 대해 더 알아보세요.

[동적 세그먼트 안에 중첩된 레이아웃](/docs/app/api-reference/file-conventions/layout#params-optional) 역시 `params` prop에 접근할 수 있습니다.

## 검색 파라미터로 렌더링하기

서버 컴포넌트 **페이지**에서는 [`searchParams`](/docs/app/api-reference/file-conventions/page#searchparams-optional) prop으로 검색 파라미터에 접근할 수 있습니다.

```tsx filename="app/page.tsx" switcher
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const filters = (await searchParams).filters;
}
```

`searchParams`를 사용하면 해당 페이지는 [**동적 렌더링**](/docs/app/glossary#dynamic-rendering)으로 전환됩니다. 검색 파라미터를 읽으려면 들어오는 요청이 필요하기 때문입니다.

클라이언트 컴포넌트에서는 [`useSearchParams`](/docs/app/api-reference/functions/use-search-params) 훅으로 검색 파라미터를 읽을 수 있습니다.

[프리렌더링된](/docs/app/api-reference/functions/use-search-params#prerendering) 라우트와 [동적으로 렌더링되는](/docs/app/api-reference/functions/use-search-params#dynamic-rendering) 라우트에서의 `useSearchParams` 동작을 더 알아보세요.

### 무엇을 언제 쓸 것인가

- 검색 파라미터가 **페이지의 데이터를 불러오는 데** 필요하다면 `searchParams` prop을 사용하세요(예: 페이지네이션, 데이터베이스 필터링).
- 검색 파라미터를 **클라이언트에서만** 사용한다면 `useSearchParams`를 사용하세요(예: 이미 props로 받아온 목록을 필터링).
- 작은 최적화로, **콜백이나 이벤트 핸들러** 안에서는 `new URLSearchParams(window.location.search)`를 사용해 리렌더링 없이 검색 파라미터를 읽을 수 있습니다.

## 페이지 사이 이동하기

[`<Link>` 컴포넌트](/docs/app/api-reference/components/link)를 사용해 라우트 사이를 이동할 수 있습니다. `<Link>`는 HTML `<a>` 태그를 확장한 Next.js 내장 컴포넌트로, [프리페치](/docs/app/getting-started/linking-and-navigating#prefetching)와 [클라이언트 사이드 내비게이션](/docs/app/getting-started/linking-and-navigating#client-side-transitions)을 제공합니다.

예를 들어 블로그 글 목록을 만들려면 `next/link`에서 `<Link>`를 import 하고 컴포넌트에 `href` prop을 전달합니다.

```tsx filename="app/ui/post.tsx" highlight={1,2,11} switcher
import Link from "next/link";
import { getPosts } from "@/lib/posts";

export default async function Posts() {
  const posts = await getPosts();

  return (
    <ul>
      {posts.map((post) => (
        <li key={post.slug}>
          <Link href={`/blog/${post.slug}`}>{post.title}</Link>
        </li>
      ))}
    </ul>
  );
}
```

> **알아두기**: `<Link>`는 Next.js에서 라우트 사이를 이동하는 기본 수단입니다. 더 고급 내비게이션이 필요하다면 [`useRouter` 훅](/docs/app/api-reference/functions/use-router)도 사용할 수 있습니다.

## 라우트 Props 헬퍼

Next.js는 라우트 구조로부터 `params`와 이름 있는 슬롯을 추론하는 유틸리티 타입을 제공합니다.

- [**PageProps**](/docs/app/api-reference/file-conventions/page#page-props-helper): `params`와 `searchParams`를 포함한 `page` 컴포넌트의 props.
- [**LayoutProps**](/docs/app/api-reference/file-conventions/layout#layout-props-helper): `children`과 이름 있는 슬롯(예: `@analytics` 같은 폴더)을 포함한 `layout` 컴포넌트의 props.

이들은 전역으로 사용할 수 있는 헬퍼이며, `next dev`, `next build`, 또는 [`next typegen`](/docs/app/api-reference/cli/next#next-typegen-options)을 실행할 때 생성됩니다.

```tsx filename="app/blog/[slug]/page.tsx"
export default async function Page(props: PageProps<"/blog/[slug]">) {
  const { slug } = await props.params;
  return <h1>Blog post: {slug}</h1>;
}
```

```tsx filename="app/dashboard/layout.tsx"
export default function Layout(props: LayoutProps<"/dashboard">) {
  return (
    <section>
      {props.children}
      {/* app/dashboard/@analytics가 있다면 타입이 지정된 슬롯으로 나타납니다: */}
      {/* {props.analytics} */}
    </section>
  );
}
```

> **알아두기**
>
> - 정적 라우트에서 `params`는 `{}`로 해석됩니다.
> - `PageProps`, `LayoutProps`는 전역 헬퍼이므로 import가 필요 없습니다.
> - 타입은 `next dev`, `next build`, `next typegen` 실행 중에 생성됩니다.

---

모든 문서의 의미 기반 개요는 [/docs/sitemap.md](/docs/sitemap.md)를 참고하세요.

사용 가능한 전체 문서 목록은 [/docs/llms.txt](/docs/llms.txt)를 참고하세요.
