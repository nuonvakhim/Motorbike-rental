# 캐싱

> 이 문서는 [Cache Components](/docs/app/api-reference/config/next-config-js/cacheComponents)를 사용한 캐싱을 다룹니다. `next.config.ts` 파일에 [`cacheComponents: true`](/docs/app/api-reference/config/next-config-js/cacheComponents)를 설정하면 활성화됩니다. Cache Components를 사용하지 않는다면 [캐싱과 재검증(이전 모델)](/docs/app/guides/caching-without-cache-components) 가이드를 참고하세요.

캐싱은 데이터 가져오기나 그 밖의 연산 결과를 저장해 두는 기법입니다. 같은 데이터에 대한 이후 요청을 같은 작업을 다시 수행하지 않고 더 빠르게 처리할 수 있습니다.

## Cache Components 활성화하기

Next 설정 파일에 [`cacheComponents`](/docs/app/api-reference/config/next-config-js/cacheComponents) 옵션을 추가하면 Cache Components를 활성화할 수 있습니다.

```ts filename="next.config.ts" switcher
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  cacheComponents: true,
}

export default nextConfig
```

> **알아두기:** Cache Components가 활성화되면 `GET` 라우트 핸들러도 페이지와 동일한 프리렌더링 모델을 따릅니다. 자세한 내용은 [Cache Components와 라우트 핸들러](/docs/app/getting-started/route-handlers#with-cache-components)를 참고하세요.

## 사용법

[`use cache`](/docs/app/api-reference/directives/use-cache) 지시어는 비동기 함수와 컴포넌트의 반환값을 캐시합니다. 두 가지 수준에서 적용할 수 있습니다.

* **데이터 수준**: 데이터를 가져오거나 계산하는 함수를 캐시합니다(예: `getProducts()`, `getUser(id)`).
* **UI 수준**: 컴포넌트나 페이지 전체를 캐시합니다(예: `async function BlogPosts()`).

캐시 지시어는 결과에 수명을 부여하며, Next.js는 이 정보를 활용해 렌더링 최적화를 적용합니다. 캐시된 결과가 어떻게 정적 셸의 일부가 되고 [프리페치](#프리페칭)에 포함될 수 있는지는 [프리렌더링](#프리렌더링)을 참고하세요.

> **알아두기:** 모든 캐시 지시어에는 [`cacheLife`](/docs/app/api-reference/functions/cacheLife)를 함께 지정하는 것을 권장합니다. 지정하지 않으면 암묵적으로 `default` 프로필이 적용됩니다.

인자와 부모 스코프에서 캡처한 값은 자동으로 [캐시 키](/docs/app/api-reference/directives/use-cache#cache-keys)의 일부가 됩니다. 따라서 입력이 다르면 서로 다른 캐시 엔트리가 만들어집니다. 엔트리에 무엇이 담기는지는 [캐시 출력](/docs/app/api-reference/directives/use-cache#cache-output)을, 무엇을 캐시할 수 있고 인자가 어떻게 동작하는지는 [직렬화 요구 사항과 제약](/docs/app/api-reference/directives/use-cache#constraints)을 참고하세요.

### 데이터 수준 캐싱

데이터를 가져오는 비동기 함수를 캐시하려면 함수 본문 맨 위에 `use cache` 지시어를 추가합니다.

```tsx filename="app/lib/data.ts" highlight={1,4,5}
import { cacheLife } from 'next/cache'

export async function getUsers() {
  'use cache'
  cacheLife('hours')
  return db.query('SELECT * FROM users')
}
```

데이터 수준 캐싱은 여러 컴포넌트에서 같은 데이터를 사용할 때, 또는 UI와 독립적으로 데이터를 캐시하고 싶을 때 유용합니다.

### UI 수준 캐싱

컴포넌트, 페이지, 레이아웃 전체를 캐시하려면 컴포넌트나 페이지 본문 맨 위에 `use cache` 지시어를 추가합니다.

```tsx filename="app/page.tsx" highlight={1,4,5}
import { cacheLife } from 'next/cache'

export default async function Page() {
  'use cache'
  cacheLife('hours')

  const users = await db.query('SELECT * FROM users')

  return (
    <ul>
      {users.map((user) => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  )
}
```

> 파일 맨 위에 "`use cache`"를 추가하면 그 파일에서 내보내는 모든 함수가 캐시됩니다.

### 캐시되지 않은 데이터 스트리밍하기

API, 데이터베이스 등 비동기 소스에서 데이터를 가져오면서 매 요청마다 최신 데이터가 필요한 컴포넌트에는 `"use cache"`를 사용하지 마세요.

대신 컴포넌트를 [`<Suspense>`](https://react.dev/reference/react/Suspense)로 감싸고 폴백 UI를 제공하세요. 폴백은 프리렌더링된 셸과 함께 전달되고, 비동기 작업은 요청 시점에 실행됩니다.

```tsx filename="page.tsx"
import { Suspense } from 'react'

async function LatestPosts() {
  const data = await fetch('https://api.example.com/posts')
  const posts = await data.json()
  return (
    <ul>
      {posts.map((post) => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  )
}

export default function Page() {
  return (
    <>
      <h1>My Blog</h1>
      <Suspense fallback={<p>Loading posts...</p>}>
        <LatestPosts />
      </Suspense>
    </>
  )
}
```

위 예시에서 `<p>Loading posts...</p>`는 정적 셸에 포함되고, 게시글은 요청 시점에 스트리밍됩니다.

캐시되지 않은 읽기를 `<Suspense>` 경계로 감싸지 않으면, 개발 오버레이에 **blocking-route** 인사이트가 다음 해결 방법과 함께 표시됩니다.

> **알아두기:** 각 해결 카드는 패턴, 코드 예시, 트레이드오프를 설명하는 상세 문서로 연결됩니다. 카드를 클릭해 자세히 살펴보세요.

`<Suspense>`는 비동기 작업이 끝날 때까지 폴백 UI를 제공할 뿐, 그 자체로 컴포넌트를 동적 렌더링으로 전환하지는 않습니다. 컴포넌트가 동기 작업만 수행한다면 `<Suspense>`로 감쌌는지와 관계없이 프리렌더링 중에 완료됩니다.

## 런타임 API 다루기

런타임 API는 사용자가 요청을 보낼 때만 알 수 있는 정보를 필요로 합니다. 다음이 여기에 해당합니다.

* [`cookies`](/docs/app/api-reference/functions/cookies) - 사용자의 쿠키 데이터
* [`headers`](/docs/app/api-reference/functions/headers) - 요청 헤더
* [`searchParams`](/docs/app/api-reference/file-conventions/page#searchparams-optional) - URL 쿼리 파라미터
* [`params`](/docs/app/api-reference/file-conventions/page#params-optional) - 동적 라우트 파라미터. [`generateStaticParams`](/docs/app/api-reference/functions/generate-static-params)로 특정 값을 빌드 시점에 프리렌더링하거나, [Cache Components와 ISR](/docs/app/guides/incremental-static-regeneration-cache-components)로 알려지지 않은 파라미터가 백그라운드에서 해석되는 동안 [App Shell](/docs/app/glossary#app-shell)을 제공할 수 있습니다.

런타임 API에 접근하는 컴포넌트는 `<Suspense>`로 감싸야 합니다.

```tsx filename="page.tsx"
import { cookies } from 'next/headers'
import { Suspense } from 'react'

async function UserGreeting() {
  const cookieStore = await cookies()
  const theme = cookieStore.get('theme')?.value || 'light'
  return <p>Your theme: {theme}</p>
}

export default function Page() {
  return (
    <>
      <h1>Dashboard</h1>
      <Suspense fallback={<p>Loading...</p>}>
        <UserGreeting />
      </Suspense>
    </>
  )
}
```

`<Suspense>` 없이 런타임 API에 접근하면 개발 오버레이에 동일한 **blocking-route** 인사이트가 동일한 해결 방법과 함께 표시됩니다.

런타임에 의존하는 데이터에도 [`"use cache: private"`](/docs/app/api-reference/directives/use-cache-private)로 캐시 수명을 부여할 수 있습니다. 이는 Cache Components와 함께 제공되는 또 다른 변형으로, 쿠키·헤더·`searchParams`를 직접 읽는 함수에 수명을 부여해 [프리페치](#프리페칭)에 포함될 수 있게 합니다.

다음 절에서는 `use cache: private`의 대안으로, 런타임 값을 추출해 공유 캐시 함수에 전달하는 방법을 설명합니다.

### 캐시된 함수에 런타임 값 전달하기

런타임 API에서 값을 추출해 캐시된 함수의 인자로 전달할 수 있습니다.

```tsx filename="app/profile/page.tsx"
import { cookies } from 'next/headers'
import { Suspense } from 'react'

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ProfileContent />
    </Suspense>
  )
}

// 캐시되지 않은 컴포넌트가 런타임 데이터를 읽습니다
async function ProfileContent() {
  const session = (await cookies()).get('session')?.value
  return <CachedContent sessionId={session} />
}

// 캐시된 컴포넌트는 추출된 값을 prop으로 받습니다
async function CachedContent({ sessionId }: { sessionId: string }) {
  'use cache'
  // sessionId가 캐시 키의 일부가 됩니다
  const data = await fetchUserData(sessionId)
  return <div>{data}</div>
}
```

요청 시점에 일치하는 캐시 엔트리가 없으면 `<CachedContent />`가 실행되고, 그 결과는 같은 `sessionId`로 들어오는 이후 요청을 위해 저장됩니다.

> **알아두기:** `<CachedContent />`는 요청 데이터에 가로막혀 있으므로 프리렌더링된 정적 셸에는 추가되지 않습니다. 런타임에는 기본적으로 [인메모리](/docs/app/api-reference/directives/use-cache#runtime-caching-considerations)로 캐시되는데, 이는 서버리스 요청 간에 유지되지 않으므로 요청마다 다시 평가될 수 있습니다. 내구성 있는 공유 캐싱이 필요하다면 [`'use cache: remote'`](/docs/app/api-reference/directives/use-cache-remote)를 사용하세요.

이 패턴을 사용하면 [프리페칭](#프리페칭)이 클라이언트 전환 중에 사용자의 실제 세션으로 `<CachedContent />`를 프리렌더링해, 클릭 전에 결과를 준비해 둘 수 있습니다. 서버 측 엔트리가 요청 사이에 거의 살아남지 못하더라도 이 방식은 동작합니다. 부여한 수명 덕분에 결과가 프리페치에 포함될 수 있고, 클라이언트는 [`cacheLife`](/docs/app/api-reference/functions/cacheLife)의 `stale` 구간 동안 이를 신선한 값으로 취급하기 때문입니다.

## 정적 콘텐츠, 캐시된 콘텐츠, 스트리밍

다음은 정적 콘텐츠, 캐시된 동적 콘텐츠, 스트리밍되는 동적 콘텐츠가 한 페이지 안에서 함께 동작하는 전체 예시입니다.

```tsx filename="app/blog/page.tsx"
import { Suspense } from 'react'
import { cookies } from 'next/headers'
import { cacheLife, cacheTag } from 'next/cache'
import Link from 'next/link'

export default function BlogPage() {
  return (
    <>
      {/* 정적 콘텐츠 - 자동으로 프리렌더링됩니다 */}
      <header>
        <h1>Our Blog</h1>
        <nav>
          <Link href="/">Home</Link> | <Link href="/about">About</Link>
        </nav>
      </header>

      {/* 캐시된 동적 콘텐츠 - 정적 셸에 포함됩니다 */}
      <BlogPosts />

      {/* 런타임 동적 콘텐츠 - 요청 시점에 스트리밍됩니다 */}
      <Suspense fallback={<p>Loading your preferences...</p>}>
        <UserPreferences />
      </Suspense>
    </>
  )
}

type Post = { id: string; title: string; author: string; date: string }

// 모든 사용자가 동일한 게시글 목록을 봅니다(한 시간마다 재검증)
async function BlogPosts() {
  'use cache'
  cacheLife('hours')
  cacheTag('posts')

  const res = await fetch('https://api.vercel.app/blog')
  const posts: Post[] = await res.json()

  return (
    <section>
      <h2>Latest Posts</h2>
      <ul>
        {posts.map((post) => (
          <li key={post.id}>
            <h3>{post.title}</h3>
            <p>
              By {post.author} on {post.date}
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}

// 쿠키에 저장된 값에 의존하는 UI
async function UserPreferences() {
  const theme = (await cookies()).get('theme')?.value || 'light'
  const favoriteCategory = (await cookies()).get('category')?.value

  return (
    <aside>
      <p>Your theme: {theme}</p>
      {favoriteCategory && <p>Favorite category: {favoriteCategory}</p>}
    </aside>
  )
}
```

프리렌더링 중에 헤더(정적)와 블로그 게시글(`use cache`로 캐시됨)은 사용자 환경 설정의 폴백 UI와 함께 정적 셸의 일부가 됩니다. 쿠키에 저장된 UI 환경 설정은 요청 시점에 스트리밍됩니다.

여기서 `cookies()`를 읽는다고 해서 이전 렌더링 모델처럼 라우트 전체가 동적 렌더링으로 전환되지는 않습니다. Suspense 경계가 런타임 접근이 스트리밍되는 자리에 폴백 UI를 제공하는 동안, 정적 콘텐츠와 캐시된 콘텐츠는 그대로 초기 HTML에 담겨 전달됩니다.

`<Suspense>`가 비동기 접근을 감싸듯, **에러 경계**는 실패를 감쌉니다. 렌더링 중 에러가 날 수 있는 하위 트리를 감싸세요. 컴포넌트 수준 경계에는 [`catchError`](/docs/app/api-reference/functions/catchError)를, 라우트 수준 경계에는 [`error.js`](/docs/app/api-reference/file-conventions/error) 파일 컨벤션을 사용합니다.

개발할 때 한 가지 더 염두에 둘 점은, [`generateMetadata`](/docs/app/api-reference/functions/generate-metadata#with-cache-components)와 [`generateViewport`](/docs/app/api-reference/functions/generate-viewport#with-cache-components) 안에서도 캐시되지 않은 fetch나 런타임 데이터 접근이 페이지에서와 동일한 인사이트와 에러를 발생시켜, 의도한 렌더링 방식으로 안내해 준다는 것입니다. 알려진 파라미터 값과 알려지지 않은 파라미터 값을 함께 다루는 증분 정적 재생성은 [Cache Components와 ISR](/docs/app/guides/incremental-static-regeneration-cache-components)을 참고하세요.

## 랜덤 값과 타임스탬프

`Math.random()`, `Date.now()`, `crypto.randomUUID()` 같은 연산은 실행될 때마다 다른 값을 만듭니다. Cache Components는 이런 값을 명시적으로 처리하도록 요구합니다.

> **알아두기:** `performance.now()`는 텔레메트리 용도이므로 Next.js는 이를 보호 대상 값으로 취급하지 않습니다. 시간 측정에 사용하고 그 결과는 렌더링하는 대신 로거나 메트릭으로 전달하세요.

**요청마다 고유한 값을 생성하려면**, 이런 연산 전에 [`connection()`](/docs/app/api-reference/functions/connection)을 호출해 요청 시점으로 미루고 컴포넌트를 `<Suspense>`로 감싸세요.

```tsx filename="page.tsx" highlight={1,4-6}
import { connection } from 'next/server'
import { Suspense } from 'react'

async function UniqueContent() {
  await connection()
  const uuid = crypto.randomUUID()
  return <p>Request ID: {uuid}</p>
}

export default function Page() {
  return (
    <Suspense fallback={<p>Loading...</p>}>
      <UniqueContent />
    </Suspense>
  )
}
```

또는 **결과를 캐시해서** 재검증 전까지 모든 사용자가 같은 값을 보게 할 수도 있습니다.

```tsx filename="page.tsx"
export default async function Page() {
  'use cache'
  const buildId = crypto.randomUUID()
  return <p>Build ID: {buildId}</p>
}
```

어떤 연산이 이렇게 동작하는지 외울 필요는 없습니다. 개발 오버레이가 호출에 따라 **blocking-prerender-random**, **blocking-prerender-current-time**, **blocking-prerender-crypto** 인사이트를 다음 해결 방법들과 함께 보여 줍니다.

## 예측 가능한 값

렌더링마다 달라질 수 있는 랜덤 값·타임스탬프와 달리, 모듈 임포트·동기 I/O·순수 연산은 실행될 때마다 같은 결과를 냅니다. 이런 연산만 사용하는 컴포넌트는 자동으로 프리렌더링되며, 그 출력은 빌드 시점에 정적 HTML의 일부가 됩니다.

```tsx filename="page.tsx"
import fs from 'node:fs'

export default async function Page() {
  const constants = await import('./constants.json')
  const content = fs.readFileSync('./config.json', 'utf-8')
  const items = JSON.parse(content).items ?? []

  return (
    <div>
      <h1>{constants.appName}</h1>
      <ul>
        {items.map((item) => (
          <li key={item.id}>{item.value}</li>
        ))}
      </ul>
    </div>
  )
}
```

> **알아두기:** 여기에는 `better-sqlite3`나 Node.js 내장 [`node:sqlite`](https://nodejs.org/api/sqlite.html)처럼 동기 API를 제공하는 임베디드 데이터베이스에 대한 쿼리도 포함됩니다. 동기 소스에서 요청별 데이터가 필요하다면 쿼리 전에 [`connection()`](/docs/app/api-reference/functions/connection)을 호출하세요.

폰트나 설정 파일처럼 들어오는 요청과 무관한 로컬 리소스를 읽는 비동기 API도 있습니다. 이런 리소스가 모든 요청에서 동일하다고 예상된다면, 렌더링 중이 아니라 모듈 스코프에서 한 번만 읽으세요.

렌더링 중에 계산하되 요청 사이에 재사용하고 싶다면 그 읽기를 [`use cache`](/docs/app/api-reference/directives/use-cache)로 감싸세요. 데이터가 들어오는 요청에 의존하거나 시간이 지나며 변한다면 요청 시점 렌더링에서 읽으세요.

```tsx filename="page.tsx"
import { readFile } from 'node:fs/promises'

const content = await readFile('./config.json', 'utf-8')
const items = JSON.parse(content).items ?? []

export default function Page() {
  return (
    <ul>
      {items.map((item) => (
        <li key={item.id}>{item.value}</li>
      ))}
    </ul>
  )
}
```

이 예시에서 설정 파일은 모든 요청에서 동일하다고 예상되므로 모듈 스코프에서 한 번만 읽습니다. 컴포넌트 안에서 `await readFile()`을 호출했다면 캐시되지 않은 데이터로 취급되어, `use cache` 안에서 접근하거나 `<Suspense>` 경계 뒤에 두어야 했을 것입니다. 이 파일은 요청에 의존하지 않고 변하지도 않으므로 모듈 스코프가 가장 단순한 선택입니다.

## 프리렌더링

빌드 시점에 Next.js는 라우트의 컴포넌트 트리를 렌더링합니다. 각 컴포넌트가 어떻게 처리되는지는 그 컴포넌트가 사용하는 API에 따라 달라집니다.

* [`use cache`](#사용법): 결과가 캐시되어 정적 셸에 포함됩니다. 단 수명이 [너무 짧지 않아야](/docs/app/api-reference/functions/cacheLife#prerendering-behavior) 합니다.
* [`<Suspense>`](#캐시되지-않은-데이터-스트리밍하기): 폴백 UI가 정적 셸에 포함되고, 콘텐츠는 요청 시점에 스트리밍됩니다.
* [예측 가능한 값](#예측-가능한-값): 모듈 임포트, `fs.readFileSync`, 순수 연산은 프리렌더링 중에 완료되어 자동으로 정적 셸에 포함됩니다.
* [랜덤 값과 타임스탬프](#랜덤-값과-타임스탬프): 요청마다 고유한 값이 필요하면 `connection()` + `<Suspense>`를, 모든 사용자가 같은 값을 공유하게 하려면 `use cache`를 사용합니다.

이 과정에서 초기 페이지 로드를 위한 HTML과 클라이언트 사이드 내비게이션을 위한 직렬화된 [RSC 페이로드](/docs/app/getting-started/server-and-client-components#on-the-server)로 이루어진 정적 셸이 생성됩니다. 덕분에 사용자가 URL로 직접 접속하든 다른 페이지에서 전환해 오든, 브라우저는 완전히 렌더링된 콘텐츠를 즉시 받게 됩니다. 이 렌더링 방식을 **부분 프리렌더링(Partial Prerendering, PPR)** 이라고 하며, Cache Components의 기본 동작입니다.

![Partially re-rendered Product Page showing static nav and product information, and dynamic cart and recommended products](https://h8DxKfmAPhn8O0p3.public.blob.vercel-storage.com/learn/light/thinking-in-ppr.png)

생성된 모든 정적 셸은 상위 서버까지 가지 않고 CDN에서 바로 제공될 수 있습니다. 그래서 직접 내비게이션이 [즉각적](#즉각적인-내비게이션)입니다.

라우트의 정적 셸에 무엇이 담기는지는 빌드 시점에 무엇을 알 수 있는지에 달려 있습니다. 라우트의 [동적 파라미터](/docs/app/api-reference/functions/generate-static-params)를 알고 있으면 셸에 해당 콘텐츠가 그대로 담기고, 남아 있는 캐시되지 않은 데이터나 런타임 데이터는 각자의 `<Suspense>` 폴백 뒤에서 스트리밍됩니다. 파라미터를 모를 때는 URL에 의존하지 않는 재사용 가능한 버전, 즉 [**App Shell**](/docs/app/glossary#app-shell)이 사용됩니다. 이는 파라미터에 의존하는 부분을 폴백 뒤에 남겨 둔 동일한 정적 셸입니다. [증분 정적 재생성](#증분-정적-재생성isr)이 첫 방문 이후에 구체적인 버전을 채워 넣습니다.

Next.js는 프리렌더링 중에 완료될 수 없는 컴포넌트를 명시적으로 처리하도록 요구합니다. 개발 오버레이와 개발 서버 콘솔에 검증 인사이트를 띄워 해당 라우트를 지목하고 해결 방법(접근을 캐시하기, `<Suspense>` 경계 안으로 옮기기, 라우트를 예외 처리하기)을 제시합니다. 이 검증 덕분에 모든 라우트가 정적 셸을 만들어 내고, 직접 내비게이션은 계속 즉각적으로 유지됩니다.

![Diagram showing partially rendered page on the client, with loading UI for chunks that are being streamed.](https://h8DxKfmAPhn8O0p3.public.blob.vercel-storage.com/docs/light/server-rendering-with-streaming.png)

> **🎥 영상:** 부분 프리렌더링이 왜 필요하고 어떻게 동작하는지 → [YouTube (10분)](https://www.youtube.com/watch?v=MTcPrTIBkpA).

### 정적 셸 극대화하기

비동기 작업이 트리에서 깊은 곳에 있을수록 페이지에서 프리렌더링할 수 있는 부분이 많아집니다. 이것이 Cache Components가 보상하는 구조적 패턴이며, 어디에나 적용할 만한 일반 원칙이자 뒤에 나올 즉각적인 내비게이션과 프리페칭의 토대입니다. 모든 [런타임 API](#런타임-api-다루기)와 데이터 가져오기 같은 비동기 연산에 적용됩니다.

최상위에서 `params`를 구조 분해하는 레이아웃을 생각해 봅시다.

```tsx filename="app/shop/[slug]/layout.tsx"
export default async function Layout({
  children,
  params,
}: LayoutProps<'/shop/[slug]'>) {
  const { slug } = await params

  return (
    <div>
      <Sidebar />
      <h1>{slug}</h1>
      {children}
    </div>
  )
}
```

이 파라미터가 동적이라면([`generateStaticParams`](/docs/app/api-reference/functions/generate-static-params)로 제공되지 않았다면) 이는 런타임 데이터이므로 레이아웃을 프리렌더링할 수 없습니다.

하지만 파라미터 값은 트리의 더 아래에서 읽을 수 있는 경우가 많습니다. 레이아웃 수준에서 await 하는 대신, params 프로미스를 아래로 내려보내 거기서 await 하세요.

```tsx filename="app/shop/[slug]/layout.tsx" highlight={3-4,11-16}
import { Suspense } from 'react'

// async가 아닙니다: 이 레이아웃은 params를 await 하지 않습니다
export default function Layout({
  children,
  params,
}: LayoutProps<'/shop/[slug]'>) {
  return (
    <div>
      <Sidebar />
      <Suspense fallback={<h1>Loading...</h1>}>
        {/* await가 경계 안에서 일어나므로 셸은 그대로 렌더링됩니다 */}
        {params.then(({ slug }) => (
          <SlugHeading slug={slug} />
        ))}
      </Suspense>
      {children}
    </div>
  )
}

function SlugHeading({ slug }: { slug: string }) {
  return <h1>{slug}</h1>
}
```

이제 `<Sidebar />`, `{children}`, Suspense 폴백이 모두 정적 셸의 일부가 됩니다. 요청 시점에 스트리밍되는 것은 `SlugHeading`뿐입니다. `params` 프로미스 전체를 넘겨 자식 컴포넌트에서 await 해도 됩니다.

같은 원리가 `cookies()`, `headers()`, `searchParams`, 데이터 가져오기에도 적용됩니다. 관련 패턴은 [`React.cache`로 데이터 재사용하기](/docs/app/getting-started/fetching-data#reusing-data-with-reactcache)를 참고하세요.

### 즉각적인 내비게이션

Cache Components는 16.0.0에서 라우트 직접 방문이 정적 셸을 만들어 내는지 검증하는 기능과 함께 출시되었습니다. 클라이언트 내비게이션은 사정이 다릅니다. 직접 방문을 커버하는 `<Suspense>` 경계가 전환 중에는 렌더링에 포함되지 않을 수 있습니다. 이런 구조를 올바르게 잡는 일은 프레임워크가 거들어 줄 때 훨씬 쉬워집니다. 이제 Cache Components는 이러한 내비게이션도 검증해, 라우트로의 내비게이션을 즉각적으로 만들도록 인사이트와 에러로 안내합니다. 예를 들어 데이터를 `<Suspense>`로 감싸거나, `use cache`로 캐시하거나, 접근이 일어나는 위치를 옮기도록 안내합니다.

예시와 검사 도구는 [즉각적인 내비게이션 가이드](/docs/app/guides/instant-navigation)를 참고하세요.

### 프리페칭

[부분 프리페칭](/docs/app/api-reference/config/next-config-js/partialPrefetching)이 활성화되면 라우터는 기본적으로 각 라우트의 [App Shell](/docs/app/glossary#app-shell)을 프리페치합니다. App Shell에는 정적 콘텐츠와 `cookies()`·`headers()`에서 도출된 세션 데이터가 포함됩니다. `searchParams`나 동적 `params`처럼 링크의 **URL 데이터**에 의존하는 캐시된 콘텐츠까지 프리페치하려면 해당 링크에 `prefetch={true}`를 설정하세요.

[부분 프리페칭](/docs/app/api-reference/config/next-config-js/partialPrefetching) 라우트를 가리키는 [`<Link prefetch={true}>`](/docs/app/api-reference/components/link#prefetch)가 있으면, Next.js는 프리페치 시점에 해당 라우트의 컴포넌트 트리를 목적지 URL이 확정된 상태로 다시 렌더링합니다. 동일한 규칙이 적용되지만, `searchParams`와 `params`를 알 수 있게 되었으므로 트리의 더 많은 부분이 이 시점에 해석됩니다.

* 런타임 API에서 추출한 값을 인자로 받아 호출된 [`use cache`](#사용법)는 링크별 프리페치에 포함됩니다.
* [`use cache: private`](/docs/app/api-reference/directives/use-cache-private)는 서버에서 실행되어 런타임 데이터를 직접 읽고, 그 결과를 링크별 프리페치의 일부로 브라우저에 캐시합니다.
* [`<Suspense>`](#캐시되지-않은-데이터-스트리밍하기) 폴백은 프리페치된 UI에 그대로 남고, 캐시되지 않은 콘텐츠는 요청 시점에 스트리밍됩니다.

이 링크별 프리페치에는 목적지 URL이 확정된 뒤에 해석되는 캐시된 콘텐츠가 포함됩니다. 프리페치 가능한 링크마다 서버 호출 한 번의 비용이 듭니다.

예를 들어 URL에서 `searchParams`를 읽는 검색 페이지를 생각해 봅시다.

```tsx filename="app/search/page.tsx"
import { Suspense } from 'react'

export default function SearchPage(props: PageProps<'/search'>) {
  return (
    <Suspense fallback={<p>Loading results...</p>}>
      <Results searchParams={props.searchParams} />
    </Suspense>
  )
}

async function Results({
  searchParams,
}: Pick<PageProps<'/search'>, 'searchParams'>) {
  const { q } = await searchParams
  const results = await search(q)
  return (
    <ul>
      {results.map((result) => (
        <li key={result.id}>{result.title}</li>
      ))}
    </ul>
  )
}

async function search(query: string | string[] | undefined) {
  'use cache'
  return db.search(query)
}
```

직접 방문할 때 `<Results>`는 폴백 뒤에서 스트리밍됩니다.

`/search?q=shoes`를 가리키는 [`<Link>`](/docs/app/api-reference/components/link)가 프리페치되면, 프레임워크가 링크의 URL에서 `searchParams`를 해석하므로 캐시된 `search` 결과가 클릭 전에 런타임 프리렌더에 포함됩니다. 그 뒤 브라우저는 [`stale`](/docs/app/api-reference/functions/cacheLife#stale) 시간이 지나거나 `searchParams`가 바뀔 때까지 그 결과를 재사용합니다.

`<Link>` 프리페칭의 동작 방식과 도입 방법은 [부분 프리페칭 도입하기](/docs/app/guides/adopting-partial-prefetching)를 참고하세요.

전체 패턴은 [프리페칭 최적화 가이드](/docs/app/guides/optimizing-prefetching)를, 모든 모드는 [`prefetch` 레퍼런스](/docs/app/api-reference/file-conventions/route-segment-config/prefetch)를 참고하세요.

## 캐시된 콘텐츠가 저장되는 위치

캐시된 함수의 출력은 빌드 시점 또는 런타임에 **RSC 페이로드**로 직렬화됩니다. 나머지 모든 동작이 이 페이로드를 바탕으로 이루어집니다. Next.js는 이를 HTML로 렌더링하거나, 서버 또는 원격 저장소에 보관하거나, 브라우저로 전송하며, [`cacheLife`](/docs/app/api-reference/functions/cacheLife)가 각 사본이 얼마나 오래 신선하게 유지될지를 정합니다.

* **프리렌더링된 HTML.** 페이로드가 HTML로 렌더링되어, 셀프 호스팅 시에는 디스크에, 플랫폼을 사용할 때는 CDN 뒤의 내구성 있는 스토리지에 저장됩니다. 이 HTML은 빌드 시점에는 [정적 셸](#프리렌더링)이고, [ISR](#증분-정적-재생성isr) 업그레이드 이후에는 구체적인 페이지가 됩니다. 언제 다시 빌드할지는 [`revalidate`](/docs/app/api-reference/functions/cacheLife#revalidate)와 [`expire`](/docs/app/api-reference/functions/cacheLife#expire)가 제어합니다.
* **공유 저장소.** 기본적으로 결과는 인스턴스별 인메모리 저장소에 남으며, 서버리스에서는 휘발성입니다. [`use cache: remote`](/docs/app/api-reference/directives/use-cache-remote)를 사용하면 여러 인스턴스가 공유하는 내구성 있는 [캐시 핸들러](/docs/app/api-reference/config/next-config-js/cacheHandlers)로 옮겨집니다. 네트워크 왕복이 발생하므로 **적중률이 높을 때만** 이득이 있습니다.
* **브라우저.** 페이로드가 클라이언트 내비게이션이나 [프리페치](#프리페칭)를 위해 전송되는 RSC에 포함되고, 브라우저는 [`stale`](/docs/app/api-reference/functions/cacheLife#stale) 구간 동안 이를 신선하게 유지합니다. [`use cache: private`](/docs/app/api-reference/directives/use-cache-private) 결과는 오직 여기에만 존재합니다.

> **알아두기:** `cookies()`나 `headers()`를 읽는 [App Shell](/docs/app/glossary#app-shell)은 세션별로 달라지므로, 공유 서버 캐시가 아니라 클라이언트에서 세션 단위로 캐시됩니다.

이 저장소들은 모두 단일 배포 범위로 한정됩니다. 새로 배포하면 처음부터 다시 시작해 새 프리렌더가 만들어지며, [캐시 키](/docs/app/api-reference/directives/use-cache#cache-keys)에 빌드 ID가 포함되기 때문에 내구성 있는 [`remote`](/docs/app/api-reference/directives/use-cache-remote) 엔트리조차 `use cache` 엔트리는 이어지지 않습니다. 환경별 동작은 [런타임 캐싱 고려 사항](/docs/app/api-reference/directives/use-cache#runtime-caching-considerations)을, 서버 캐시 설정은 [셀프 호스팅](/docs/app/guides/self-hosting#caching-and-isr)을 참고하세요.

## 증분 정적 재생성(ISR)

동적 파라미터 세그먼트가 있는 라우트에서 [`generateStaticParams`](/docs/app/api-reference/functions/generate-static-params)는 나열한 URL들을 빌드 시점에 프리렌더링합니다. 그 외의 URL에는 [App Shell](/docs/app/glossary#app-shell)이 즉시 제공된 뒤, 이제 알게 된 파라미터로 백그라운드에서 업그레이드되어 다음 방문자를 위해 캐시됩니다.

전체 과정은 [Cache Components와 ISR](/docs/app/guides/incremental-static-regeneration-cache-components)을 참고하세요.

## 봇과 크롤러

브라우저는 정적 셸을 즉시 받습니다. 봇과 크롤러는 user agent로 식별되어 다르게 처리됩니다. 이들에게는 완전한 문서가 필요하므로, Next.js는 셸을 건너뛰고 요청 시점에 페이지 전체를 동적으로 렌더링한 뒤 렌더링이 끝나면 완성된 HTML을 보냅니다.

셸이 재사용되지 않고 다시 렌더링되기 때문에, 프리렌더링 중에 완료되었던 작업이 봇에 대해서는 요청 시점에 실행됩니다. 셸의 일부가 프리렌더링 중에만 존재하는 입력값, 예컨대 빌드 시점 데이터나 요청 시점 환경에서는 접근할 수 없는 값에 의존한다면, 사람에게는 잘 열리는 페이지가 크롤러에게는 렌더링에 실패할 수 있습니다. 셸이 의존하는 데이터가 요청 시점에도 사용 가능한지 반드시 확인하세요. 자세한 내용은 스트리밍 가이드의 [봇과 크롤러](/docs/app/guides/streaming#bots-and-crawlers)를 참고하세요.
