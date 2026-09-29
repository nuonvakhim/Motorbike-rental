# Next.JS
# App Router

App Router는 `app/` 디렉터리에서 동작하는 Next.js의 파일 시스템 기반 라우터입니다. 폴더가 URL 세그먼트를 정의하고, 그 안의 특수 파일이 해당 세그먼트의 UI를 정의합니다. React 서버 컴포넌트를 기반으로 하므로 페이지와 레이아웃은 기본적으로 서버에서 렌더링됩니다.

Next.js가 제공하는 두 가지 라우터 중 하나입니다(기존 `pages/` 라우터도 계속 지원됩니다). 구분 기준은 다음과 같습니다. `app/` = 서버 컴포넌트 + React canary 기능, `pages/` = 기존의 클라이언트 중심 모델.

## App Router의 동작 방식
App Router는 폴더가 라우트를 정의하고 특수 파일이 UI 컴포넌트를 정의하는 `app` 디렉터리를 사용합니다.
```tsx
app/
├── layout.tsx        // 루트 레이아웃 (필수, <html>과 <body>를 렌더링해야 함)
├── page.tsx          // 라우트: /
├── about/
│   └── page.tsx      // 라우트: /about
├── blog/
│   ├── layout.tsx    // 블로그 레이아웃
│   ├── loading.tsx   // /blog의 로딩 UI
│   ├── page.tsx      // 라우트: /blog
│   └── [slug]/
│       └── page.tsx  // 라우트: /blog/[slug]
└── api/
    └── users/
        └── route.ts  // API 라우트: /api/users
```

한 줄로 정리하면 **폴더가 URL을 만들고, 파일이 UI를 만듭니다.** 폴더는 그 안에 `page.tsx`(또는 `route.ts`)가 있을 때에만 공개 라우트가 됩니다. 라우트 폴더에 넣은 그 밖의 것들 — 컴포넌트, 헬퍼, 테스트 — 은 절대 URL이 되지 않습니다.

### 특수 파일

| 파일 | 역할 |
| ---- | ---- |
| `layout.tsx` | 내비게이션 사이에 **유지되는** 공유 UI — 상태를 보존하고, 상호작용을 유지하며, 다시 렌더링되지 않음 |
| `template.tsx` | 레이아웃과 비슷하지만 내비게이션마다 **새 인스턴스**가 생성됨(상태 초기화, 이펙트 재실행) |
| `page.tsx` | 해당 라우트만의 UI — 라우트를 외부에 공개하는 역할 |
| `loading.tsx` | 즉시 표시되는 로딩 UI. 해당 세그먼트를 자동으로 `<Suspense>` 경계로 감쌈 |
| `error.tsx` | 해당 세그먼트와 하위 요소의 에러 경계 — 반드시 클라이언트 컴포넌트여야 함 |
| `global-error.tsx` | 루트 레이아웃의 에러 경계. 자체적으로 `<html>`/`<body>`를 렌더링해야 함 |
| `not-found.tsx` | `notFound()` 호출 및 일치하지 않는 URL에 대한 UI |
| `forbidden.tsx` / `unauthorized.tsx` | `forbidden()` / `unauthorized()`에 대한 UI |
| `route.ts` | API 엔드포인트 — `page.tsx`와 같은 세그먼트에 둘 수 없음 |
| `default.tsx` | 병렬 라우트 슬롯의 폴백 |
| `proxy.ts` | 요청이 완료되기 전에 실행됨 — `app/` 옆, 프로젝트 루트에 위치 |

중첩 순서: `layout` → `template` → `error` → `loading` → `not-found` → `page`.

## App Router의 주요 기능

### 1. 기본값은 서버 컴포넌트

`app/` 안의 모든 파일은 따로 지정하지 않는 한 서버 컴포넌트입니다. 코드가 브라우저로 전송되지 않으므로 컴포넌트 안에서 직접 데이터베이스를 조회하거나 시크릿을 사용할 수 있습니다.

```tsx
// app/page.tsx (서버 컴포넌트)
async function getData() {
  // 외부 호출에는 항상 타임아웃을 지정합니다. 무한 재시도는 금지입니다.
  const res = await fetch('https://api.example.com/data', {
    signal: AbortSignal.timeout(5000),
  })
  if (!res.ok) throw new Error('Failed to fetch data')
  return res.json()
}

export default async function HomePage() {
  const data = await getData()

  return <h1>Welcome! {data.message}</h1>
}
```

`'use client'`는 상태, 이벤트 핸들러, 이펙트, 브라우저 API, 커스텀 훅이 필요할 때에만 사용하고, 트리의 **말단**에 두십시오. 권장되는 패턴은 서버에서 데이터를 가져와 props로 내려주고, 작은 클라이언트 영역이 상호작용만 담당하게 하는 것입니다.

```tsx
// app/ui/like-button.tsx
'use client'

import { useState } from 'react'

export default function LikeButton({ likes }: { likes: number }) {
  const [count, setCount] = useState(likes)
  return <button onClick={() => setCount(count + 1)}>{count} ♥</button>
}
```

`'use client'`는 파일 하나가 아니라 **경계**를 나타냅니다. 해당 모듈 그래프로 import되는 모든 것이 함께 클라이언트 코드가 됩니다.

### 2. 레이아웃과 템플릿
```tsx
// app/layout.tsx (루트 레이아웃 — 필수이며, <html>/<body>가 존재하는 유일한 곳)
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <nav>Navigation</nav>
        {children}
        <footer>Footer</footer>
      </body>
    </html>
  )
}

// app/blog/layout.js (중첩 레이아웃)
export default function BlogLayout({ children }) {
  return (
    <div className="blog-layout">
      <aside>Blog Sidebar</aside>
      <main>{children}</main>
    </div>
  )
}
```

핵심 특성은 레이아웃이 **내비게이션 후에도 유지된다**는 점입니다. 하위 페이지 사이를 이동해도 사이드바 스크롤 위치, 열려 있는 메뉴, 레이아웃 내부의 폼 상태가 그대로 보존됩니다. 레이아웃은 폴더 계층 구조를 따라 자동으로 중첩됩니다.

`template.tsx`는 그 반대입니다. 내비게이션마다 다시 마운트되므로 상태가 초기화되고 `useEffect`가 다시 실행됩니다. **기본은 레이아웃을 쓰고, 초기화가 필요할 때에만 템플릿을 사용하십시오**(진입 애니메이션, 의도적으로 비워야 하는 상태 등).

### 3. 라우트 그룹과 파일 구성

```tsx
app/
├── (marketing)/
│   ├── about/
│   │   └── page.tsx    // 라우트: /about
│   └── contact/
│       └── page.tsx    // 라우트: /contact
└── (shop)/
    ├── products/
    │   └── page.tsx      // 라우트: /products
    └── cart/
        └── page.tsx      // 라우트: /cart
```

괄호로 감싼 폴더는 URL에 포함되지 않습니다. 팀이나 기능 단위로 라우트를 묶거나, 특정 영역에만 별도의 루트 레이아웃을 부여할 때 사용합니다. 주의할 점 두 가지가 있습니다.

- **경로가 충돌하면 오류가 발생합니다** — `(marketing)/about/`과 `(shop)/about/`은 둘 다 `/about`으로 해석되어 빌드가 실패합니다.
- **루트 레이아웃이 여러 개이면** 그 사이를 이동할 때 문서 자체가 교체되므로 **전체 페이지가 새로고침됩니다**.

관련 규칙으로, `_`로 시작하는 폴더(예: `_components/`, `_lib/`)는 절대 라우트가 되지 않습니다. 그래서 해당 라우트에서 쓰는 헬퍼를 바로 옆에 두기에 적합합니다.

### 4. 로딩과 에러 UI
```tsx
// app/blog/loading.tsx
export default function Loading() {
  return <div>Loading blog posts...</div>
}

// app/blog/error.tsx
'use client'
export default function Error({ error, retry }) {
  return (
    <div>
      <h2>Something went wrong!</h2>
      <button onClick={() => retry()}>Try again</button>
    </div>
  )
}
```

`loading.tsx` 파일을 두기만 하면 해당 세그먼트가 자동으로 `<Suspense>` 경계로 감싸집니다.

> ⚠️ **v16:** 에러 prop은 `reset`이 아니라 **`retry`** 입니다. `retry()`는 세그먼트를 다시 가져와 다시 렌더링하지만, `reset()`은 다시 가져오지 않고 에러 상태만 초기화합니다. 오래된 튜토리얼에는 `reset`으로 나옵니다.

`error.tsx`는 자신의 세그먼트와 그 하위에서 발생한 에러를 잡지만, **같은 세그먼트의 레이아웃**에서 발생한 에러는 잡지 못합니다. 그 경우에는 루트의 `global-error.tsx`가 필요합니다. 또한 *예상 가능한* 에러(폼 검증 실패, 로그인 실패 등)는 throw하지 말고 값으로 반환한 뒤 `useActionState`로 화면에 표시하십시오.

### 5. 스트리밍과 Suspense
```tsx
// app/dashboard/page.tsx
import { Suspense } from 'react'

async function UserData() {
  const data = await fetchUserData() // 스트리밍될 수 있음
  return <div>{data.name}</div>
}

export default function Dashboard() {
  return (
    <div>
      <h1>Dashboard</h1>
      <Suspense fallback={<div>Loading user...</div>}>
        <UserData />
      </Suspense>
    </div>
  )
}
```

`loading.tsx`는 세그먼트 전체를 스트리밍하고, `<Suspense>`는 컴포넌트 단위로 제어할 수 있게 해 줍니다. 덕분에 느린 쿼리 하나가 페이지 전체를 붙잡지 않습니다. 폴백은 정적 셸의 일부이므로 데이터가 준비되기 전에 미리 렌더링되어 먼저 전송될 수 있습니다.

다만 `<Suspense>` 자체가 컴포넌트를 동적으로 만들지는 않습니다. 동기 작업만 하는 컴포넌트는 프리렌더링 단계에서 그대로 완료됩니다.

### 6. 동적 라우트

폴더 이름을 대괄호로 감싸면 변수가 됩니다.

| 표기 | 라우트 | `/shop/a/b`의 결과 |
| ---- | ------ | ------------------ |
| `[slug]` | `app/blog/[slug]/page.tsx` | `{ slug: 'a' }` — 세그먼트 한 개 |
| `[...slug]` | `app/shop/[...slug]/page.tsx` | `{ slug: ['a', 'b'] }` — catch-all |
| `[[...slug]]` | `app/shop/[[...slug]]/page.tsx` | 위와 같지만 `/shop` 자체도 매칭됨 |

> ⚠️ **v16: `params`는 Promise입니다.** 오래된 튜토리얼과 가장 크게 달라진 부분입니다. `params`, `searchParams`, `cookies()`, `headers()`, `draftMode()`는 모두 비동기 전용이며, Next 15에 있던 동기 방식 폴백은 제거되었습니다.

```tsx
// app/blog/[slug]/page.tsx
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params   // ← 반드시 await
  return <div>My Post: {slug}</div>
}
```

클라이언트 컴포넌트에서는 React의 `use()`로 풀거나, 클라이언트 트리 어디에서든 `useParams()`로 읽을 수 있습니다.

또한 Next.js는 실제 폴더 구조로부터 **전역 라우트 타입**을 생성하므로 `params` 타입을 직접 작성할 필요가 없습니다. `next dev`, `next build`, `next typegen` 실행 후에는 `PageProps<'/route'>`, `LayoutProps<'/route'>`, `RouteContext<'/route'>`를 import 없이 사용할 수 있습니다.

```tsx
export default async function Page(props: PageProps<'/blog/[slug]'>) {
  const { slug } = await props.params
  return <h1>Blog Post: {slug}</h1>
}
```

동적 페이지를 빌드 시점에 미리 렌더링하려면 `generateStaticParams`를 export하십시오.

### 7. 라우트 핸들러 (API 엔드포인트)

`route.ts`가 기존의 `pages/api/`를 대체합니다. HTTP 메서드마다 함수를 하나씩 export합니다 — `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`. 그 외의 메서드는 `405`를 반환합니다.

```ts
// app/api/users/route.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q')
  const users = await db.user.findMany({ where: { name: { contains: query } } })
  return NextResponse.json(users)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const user = await db.user.create({ data: body })
  return NextResponse.json(user, { status: 201 })
}
```

라우트 핸들러는 **기본적으로 캐시되지 않습니다**. `GET`은 `export const dynamic = 'force-static'`으로 캐싱을 선택할 수 있습니다. `route.ts`는 `page.tsx`와 같은 폴더에 둘 수 없습니다.

애초에 라우트 핸들러가 필요한지 먼저 따져볼 필요가 있습니다. 서버 컴포넌트가 데이터를 직접 가져올 수 있다면 필요하지 않습니다. 라우트 핸들러는 웹훅, 서드파티 콜백, 그리고 앱 외부의 클라이언트를 위해 쓰일 때 가치가 있습니다.

### 8. 서버 함수와 서버 액션

`'use server'` 지시어는 async 함수를 서버 전용으로 표시합니다. 클라이언트에서 호출하면 내부적으로 `POST` 요청이 전송되고, Next.js는 갱신된 UI와 새 데이터를 한 번의 왕복으로 함께 반환합니다. 폼 제출이나 데이터 변경에 쓰일 때 이를 **서버 액션**이라고 부릅니다.

```ts
// app/lib/actions.ts
'use server'

import { auth } from '@/lib/auth'
import { updateTag } from 'next/cache'

export async function createPost(formData: FormData) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const title = formData.get('title')
  await db.post.create({ data: { title, authorId: session.user.id } })

  updateTag('posts')   // 캐시를 무효화해 새 글이 즉시 보이도록 함
}
```

폼에 바로 연결할 수 있습니다. `onSubmit`도, `fetch`도, API 라우트도 필요 없습니다.

```tsx
import { createPost } from '@/app/lib/actions'

export default function NewPost() {
  return (
    <form action={createPost}>
      <input name="title" required />
      <button type="submit">Create</button>
    </form>
  )
}
```

> **보안 주의:** 서버 함수는 작성한 폼을 통해서만이 아니라 외부에서 직접 보낸 `POST` 요청으로도 호출될 수 있습니다. 모든 서버 함수 내부에서 인증과 **권한**을 반드시 확인하십시오. 자신의 UI만 호출할 수 있다고 가정해서는 안 됩니다.

### 9. 캐싱

> ⚠️ **v16:** `fetch`는 **더 이상 기본으로 캐시되지 않으며**, 실험적 기능이던 Partial Prerendering 플래그는 **Cache Components**로 대체되었습니다.

캐싱은 선택적으로 활성화합니다. 설정에서 모델을 켜십시오.

```ts
// next.config.ts
const nextConfig: NextConfig = { cacheComponents: true }
```

그다음 `'use cache'`로 async 함수의 반환값(데이터 단위)이나 컴포넌트·페이지 전체(UI 단위)를 캐시합니다. 반드시 `cacheLife`와 함께 사용하십시오. 생략하면 암묵적으로 `default` 프로파일이 적용되는데, 의도한 값인 경우는 드뭅니다.

```tsx
import { cacheLife, cacheTag } from 'next/cache'

export async function getUsers() {
  'use cache'
  cacheLife('hours')   // seconds | minutes | hours | days | weeks | max
  cacheTag('users')
  return db.query('SELECT * FROM users')
}
```

인자와 상위 스코프에서 캡처한 값이 캐시 키의 일부가 됩니다. 매 요청마다 최신이어야 하는 데이터는 캐시하지 **말고**, `<Suspense>`로 감싸 셸은 미리 렌더링되고 최신 데이터만 스트리밍되도록 하십시오.

데이터 변경 후 캐시를 지우는 방법:

| API | 동작 | 사용 시점 |
| --- | ---- | --------- |
| `revalidateTag(tag)` | stale-while-revalidate — 이전 값을 먼저 보여주고 뒤에서 갱신 | 백그라운드 갱신. 약간의 지연이 괜찮을 때 |
| `updateTag(tag)` | 즉시 만료(서버 액션에서만 사용 가능) | 사용자가 자신의 변경을 바로 확인해야 할 때 |
| `revalidatePath(path)` | 라우트 전체를 무효화 | 최후의 수단 — 태그 방식이 더 정밀함 |

### 10. 병렬 라우트와 인터셉트 라우트

**병렬 라우트**(`@folder`)는 여러 페이지를 하나의 레이아웃에 동시에 렌더링하며, 각각 독립적인 로딩·에러 상태를 가집니다. 슬롯은 공유 부모 레이아웃의 props로 전달됩니다.

```tsx
app/
├── layout.tsx        // `children`, `team`, `analytics`를 전달받음
├── @team/
│   ├── page.tsx
│   └── default.tsx   // ⚠️ v16: 필수. 없으면 빌드 실패
└── @analytics/
    ├── page.tsx
    └── default.tsx
```

일치하는 하위 라우트가 없는 슬롯은 `default.tsx`로 폴백됩니다. v16 이전과 같은 동작을 원한다면 `return null`을 하거나 `notFound()`를 호출하십시오.

**인터셉트 라우트**는 다른 위치의 라우트를 현재 레이아웃 안에서 불러옵니다. 대표적인 예가 사진을 클릭하면 피드 위에 모달로 열리지만, URL을 공유하거나 새로고침하면 전체 페이지로 렌더링되는 경우입니다.

| 패턴 | 가로채는 대상 |
| ---- | ------------- |
| `(.)folder` | 같은 레벨 |
| `(..)folder` | 한 단계 위 |
| `(..)(..)folder` | 두 단계 위 |
| `(...)folder` | `app` 루트부터 |

### 11. 메타데이터와 SEO

정적인 `metadata` 객체를 export하거나, 태그가 데이터에 의존할 때에는 `generateMetadata` 함수를 export합니다. 둘 다 서버 컴포넌트에서만 사용할 수 있습니다.

```tsx
// 정적
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'My Blog',
  description: 'Notes about web development',
}

// 동적 — 제목이 데이터에 따라 달라질 때
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const post = await getPost(slug)
  return { title: post.title, description: post.excerpt }
}
```

`charset`과 `viewport` 태그는 항상 자동으로 추가됩니다. 나머지는 파일 규칙으로 처리합니다: `favicon.ico`, `icon.tsx`, `opengraph-image.tsx`, `twitter-image.tsx`, `robots.ts`, `sitemap.ts`.

### 12. 내비게이션

내비게이션에는 사실상 항상 `<Link>`를 사용하십시오. 클라이언트 사이드 전환(전체 새로고침 없음, 레이아웃 유지)과, 링크가 뷰포트에 들어올 때의 자동 프리페치를 제공합니다.

```tsx
import Link from 'next/link'

<Link href={`/blog/${post.slug}`}>{post.title}</Link>
```

> **프리페치는 프로덕션에서만 동작합니다.** `next dev`에서는 프리페치가 일어나지 않아 실제보다 내비게이션이 느리게 느껴집니다. 개발 서버의 체감 속도로 성능을 판단하지 마십시오.

코드에서 이동할 때 쓰는 `useRouter`는 **`next/navigation`**에서 가져오며(`next/router`가 아닙니다) 클라이언트 컴포넌트에서만 동작합니다. 함께 쓰는 훅인 `usePathname()`, `useSearchParams()`, `useParams()`도 같은 모듈에서 제공됩니다.

### 13. Proxy

> ⚠️ **v16:** `middleware.ts`가 **`proxy.ts`**로 이름이 변경되었습니다. 기능은 동일하며, 네트워크 경계를 다루는 역할임을 명확히 하기 위한 변경입니다.

```ts
// proxy.ts (프로젝트 루트, app/ 옆)
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  return NextResponse.redirect(new URL('/home', request.url))
}

export const config = {
  matcher: '/about/:path*',
}
```

프로젝트당 proxy 파일은 하나만 둘 수 있습니다. 리다이렉트, 리라이트, 헤더·쿠키 변경을 위한 것이며, 느린 데이터 페칭이나 본격적인 인가 계층으로 쓰기에는 적합하지 않습니다(낙관적 검사에만 사용하고, 실제 검증은 서버 컴포넌트나 서버 함수에서 수행하십시오).

## App Router의 장점

- React 서버 컴포넌트: 더 나은 성능과 작은 번들 크기
- 스트리밍: 점진적 페이지 렌더링으로 향상된 사용자 경험
- 유연한 레이아웃: 라우트 변경 시에도 유지되는 중첩 레이아웃
- 내장 로딩 상태: 자동 로딩·에러 경계
- 향상된 SEO: 개선된 서버 사이드 렌더링
- 최신 React 패턴: React의 최신 기능 활용
- 데이터 변경 로직의 코로케이션: 서버 액션이 직접 작성하던 API 라우트 대부분을 대체
- 세밀한 캐싱: 태그와 함께 쓰는 `use cache`가 기존의 전부 아니면 전무 방식의 fetch 캐시를 대체

### 주요 차이점 비교

| 항목 | Page Router | App Router |
| ---- | ----------- | ---------- |
| 디렉터리 | `pages/` | `app/` |
| 라우팅 방식 | 파일 기반 | 폴더 기반 |
| 컴포넌트 | 기본값이 클라이언트 | 기본값이 서버 |
| 데이터 페칭 | `getServerSideProps`, `getStaticProps` | 컴포넌트 안에서 `fetch()` / `await` |
| 데이터 변경 | API 라우트 + 클라이언트 `fetch` | 서버 액션 (`'use server'`) |
| 레이아웃 | `_app.js`, `_document.js` | `layout.js` (중첩 가능) |
| 로딩 상태 | 직접 구현 | 내장 `loading.js` |
| 에러 처리 | `_error.js` | `error.js` / `global-error.js` |
| API 엔드포인트 | `pages/api/*.ts` | `route.ts` 라우트 핸들러 |
| 메타데이터 | `next/head` | `metadata` / `generateMetadata` |
| 라우팅 훅 | `next/router` | `next/navigation` |
| 번들 크기 | 큰 클라이언트 번들 | 작은 클라이언트 번들 |

### Next.js 16에서 바뀐 점

온라인 튜토리얼 대부분은 Next.js 13/14를 기준으로 합니다. 그대로 복사한 코드가 깨지는 App Router 관련 차이는 다음과 같습니다.

| 오래된 튜토리얼의 설명 | Next.js 16 |
| --- | --- |
| `const { slug } = params` | `params`는 **Promise** → `await params` |
| `const { q } = searchParams` | 마찬가지로 Promise → `await searchParams` |
| `error.tsx`는 `reset` prop을 받음 | **`retry`** 를 받음 |
| `middleware.ts` | **`proxy.ts`** 로 이름 변경 |
| `fetch`는 기본으로 캐시됨 | **캐시되지 않음** — `use cache`로 선택 |
| 병렬 슬롯은 `default.tsx` 없이 동작 | `default.tsx`가 **필수** |
| Partial Prerendering에 `experimental.ppr` 사용 | `cacheComponents: true`로 대체 |
| `params` 타입을 직접 작성 | 생성된 `PageProps<'/route'>` 사용 |

### 결론
Page Router와 App Router 모두 Next.js 생태계에서 각자의 자리를 가지고 있습니다. Page Router는 안정성과 단순함을 제공하므로 여전히 많은 애플리케이션에 적합한 선택입니다. App Router는 더 복잡하지만, 성능과 개발자 경험을 크게 개선할 수 있는 강력한 기능을 제공합니다.
