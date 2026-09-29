# 데이터 가져오기


> 모든 Next.js 문서 목록은 [/docs/llms.txt](/docs/llms.txt)를 참고하세요.
이 문서에서는 [서버 컴포넌트](#서버-컴포넌트)와 [클라이언트 컴포넌트](#클라이언트-컴포넌트)에서 데이터를 가져오는 방법, 그리고 캐시되지 않은 데이터에 의존하는 컴포넌트를 [스트리밍](#스트리밍)하는 방법을 안내합니다.

## 데이터 가져오기

### 서버 컴포넌트

서버 컴포넌트에서는 다음과 같은 비동기 I/O를 무엇이든 사용해 데이터를 가져올 수 있습니다.

1. [`fetch` API](#fetch-api-사용하기)
2. [ORM이나 데이터베이스](#orm이나-데이터베이스-사용하기)

#### `fetch` API 사용하기

`fetch` API로 데이터를 가져오려면 컴포넌트를 비동기 함수로 만들고 `fetch` 호출을 await 하면 됩니다. 예를 들면 다음과 같습니다.

```tsx filename="app/blog/page.tsx" switcher
export default async function Page() {
  const data = await fetch('https://api.vercel.app/blog')
  const posts = await data.json()
  return (
    <ul>
      {posts.map((post) => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  )
}
```


> **알아두기**
>
> * React 컴포넌트 트리 안에서 동일한 `fetch` 요청은 기본적으로 [메모이제이션](/docs/app/glossary#memoization)됩니다. 따라서 props로 내려주는 대신 데이터가 필요한 컴포넌트에서 바로 가져와도 됩니다.
> * `fetch` 요청은 기본적으로 캐시되지 않으며, 요청이 끝날 때까지 페이지 렌더링을 막습니다. 결과를 캐시하려면 [`use cache`](/docs/app/api-reference/directives/use-cache) 지시어를 사용하고, 요청 시점의 최신 데이터를 스트리밍하려면 데이터를 가져오는 컴포넌트를 [`<Suspense>`](/docs/app/getting-started/caching#streaming-uncached-data)로 감싸세요. 자세한 내용은 [캐싱](/docs/app/getting-started/caching)을 참고하세요.
> * 개발 중에는 `fetch` 호출을 로그로 남겨 가시성과 디버깅을 개선할 수 있습니다. [`logging` API 레퍼런스](/docs/app/api-reference/config/next-config-js/logging)를 참고하세요.

#### ORM이나 데이터베이스 사용하기

서버 컴포넌트는 서버에서 렌더링되므로 자격 증명과 쿼리 로직이 클라이언트 번들에 포함되지 않습니다. 따라서 ORM이나 데이터베이스 클라이언트로 안전하게 데이터베이스 쿼리를 실행할 수 있습니다.

```tsx filename="app/blog/page.tsx" switcher
import { db, posts } from '@/lib/db'

export default async function Page() {
  const allPosts = await db.select().from(posts)
  return (
    <ul>
      {allPosts.map((post) => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  )
}
```



그렇더라도 요청에 대한 인증과 인가는 반드시 직접 보장해야 합니다. 서버 측 데이터 접근을 안전하게 다루는 모범 사례는 [데이터 보안 가이드](/docs/app/guides/data-security)를 참고하세요.

### 스트리밍

서버 컴포넌트에서 데이터를 가져오면 요청마다 서버에서 데이터를 가져오고 렌더링합니다. 느린 데이터 요청이 하나라도 있으면 모든 데이터를 가져올 때까지 라우트 전체의 렌더링이 막힙니다.

초기 로드 시간과 사용자 경험을 개선하려면 페이지를 더 작은 *청크*로 나누고, 그 청크를 서버에서 클라이언트로 점진적으로 전송할 수 있습니다. 이것을 스트리밍이라고 합니다. 스트리밍의 동작 방식, HTTP 계약, 인프라 고려사항, 성능 트레이드오프를 더 깊이 다룬 내용은 [스트리밍 가이드](/docs/app/guides/streaming)를 참고하세요.

![스트리밍을 사용한 서버 렌더링의 동작 방식](https://h8DxKfmAPhn8O0p3.public.blob.vercel-storage.com/docs/light/server-rendering-with-streaming.png)

애플리케이션에서 스트리밍을 사용하는 방법은 두 가지입니다.

1. [`loading.js` 파일](#loadingjs-사용하기)로 페이지 감싸기
2. [`<Suspense>`](#suspense-사용하기)로 컴포넌트 감싸기

> **알아두기**: 봇과 크롤러는 브라우저와 다르게 처리됩니다. Next.js는 데이터 가져오기가 끝날 때까지 기다렸다가 점진적으로 스트리밍하는 대신 완전히 렌더링된 페이지를 보냅니다. [봇과 크롤러](/docs/app/guides/streaming#bots-and-crawlers)를 참고하세요.

#### `loading.js` 사용하기

페이지와 같은 폴더에 `loading.js` 파일을 만들면 데이터를 가져오는 동안 **페이지 전체**를 스트리밍할 수 있습니다. 예를 들어 `app/blog/page.js`를 스트리밍하려면 `app/blog` 폴더 안에 파일을 추가합니다.

```tsx
app/
└── blog/
    ├── loading.tsx   // page.tsx가 렌더링되는 동안 스트리밍됩니다
    └── page.tsx      // 라우트: /blog
```

```tsx filename="app/blog/loading.tsx" switcher
export default function Loading() {
  // 여기에 로딩 UI를 정의합니다
  return <div>Loading...</div>
}
```


내비게이션이 일어나면 사용자는 페이지가 렌더링되는 동안 레이아웃과 [로딩 상태](#의미-있는-로딩-상태-만들기)를 즉시 보게 됩니다. 렌더링이 끝나면 새 콘텐츠가 자동으로 교체되어 들어옵니다.

![로딩 UI](https://h8DxKfmAPhn8O0p3.public.blob.vercel-storage.com/docs/light/loading-ui.png)

내부적으로 `loading.js`는 [`layout.js` 안에 중첩되며](/docs/app/getting-started/project-structure#component-hierarchy), `page.js` 파일과 그 아래의 모든 자식을 `<Suspense>` 경계로 자동으로 감쌉니다.

![loading.js 개요](https://h8DxKfmAPhn8O0p3.public.blob.vercel-storage.com/docs/light/loading-overview.png)

이런 구조 때문에, 캐시되지 않은 데이터나 런타임 데이터(예: `cookies()`, `headers()`, 캐시되지 않은 fetch)에 접근하는 레이아웃은 같은 라우트 세그먼트의 `loading.js`로 폴백되지 않습니다. 대신 레이아웃 렌더링이 끝날 때까지 내비게이션을 막습니다. [Cache Components](/docs/app/getting-started/caching)는 빌드 타임 에러로 안내해 이 문제를 방지합니다.

이를 해결하려면 캐시되지 않은 접근을 폴백이 있는 자체 [`<Suspense>`](#suspense-사용하기) 경계로 감싸거나, 데이터 가져오기를 `loading.js`가 커버할 수 있는 `page.js`로 옮기세요. 자세한 내용은 [`loading.js`](/docs/app/api-reference/file-conventions/loading)를 참고하세요.

그래서 `loading.js`는 라우트 세그먼트를 스트리밍하는 데는 잘 맞지만, 런타임 데이터나 캐시되지 않은 데이터 접근에 더 가까운 곳에서 `<Suspense>`를 쓰는 편이 권장됩니다.

#### `<Suspense>` 사용하기

`<Suspense>`를 사용하면 페이지의 어느 부분을 스트리밍할지 더 세밀하게 정할 수 있습니다. 예를 들어 `<Suspense>` 경계 바깥에 있는 페이지 콘텐츠는 즉시 보여주고, 경계 안의 블로그 글 목록은 스트리밍으로 채워 넣을 수 있습니다.

```tsx filename="app/blog/page.tsx" switcher
import { Suspense } from 'react'
import BlogList from '@/components/BlogList'
import BlogListSkeleton from '@/components/BlogListSkeleton'

export default function BlogPage() {
  return (
    <div>
      {/* 이 콘텐츠는 즉시 클라이언트로 전송됩니다 */}
      <header>
        <h1>Welcome to the Blog</h1>
        <p>Read the latest posts below.</p>
      </header>
      <main>
        {/* 이 경계 안에 동적 콘텐츠가 있으면 스트리밍으로 전달됩니다 */}
        <Suspense fallback={<BlogListSkeleton />}>
          <BlogList />
        </Suspense>
      </main>
    </div>
  )
}
```


#### 의미 있는 로딩 상태 만들기

즉각적인 로딩 상태란 내비게이션 직후 사용자에게 즉시 보여지는 폴백 UI입니다. 사용자 경험을 위해서는 앱이 반응하고 있음을 이해시킬 수 있는 의미 있는 로딩 상태를 설계하는 것이 좋습니다. 예를 들어 스켈레톤이나 스피너를 쓰거나, 커버 사진·제목처럼 곧 나타날 화면의 작지만 의미 있는 일부를 보여줄 수 있습니다.

개발 중에는 [React Devtools](https://react.dev/learn/react-developer-tools)로 컴포넌트의 로딩 상태를 미리 보고 확인할 수 있습니다.

### 클라이언트 컴포넌트

클라이언트 컴포넌트에서 데이터를 가져오는 방법은 두 가지입니다.

1. React의 [`use` API](https://react.dev/reference/react/use)
2. [SWR](https://swr.vercel.app/)이나 [React Query](https://tanstack.com/query/latest) 같은 커뮤니티 라이브러리

#### `use` API로 데이터 스트리밍하기

React의 [`use` API](https://react.dev/reference/react/use)를 사용하면 서버에서 클라이언트로 데이터를 [스트리밍](#스트리밍)할 수 있습니다. 먼저 서버 컴포넌트에서 데이터를 가져오고, 그 프라미스를 클라이언트 컴포넌트에 prop으로 전달하세요.

```tsx filename="app/blog/page.tsx" switcher
import Posts from '@/app/ui/posts'
import { Suspense } from 'react'

export default function Page() {
  // 데이터 가져오기 함수를 await 하지 않습니다
  const posts = getPosts()

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Posts posts={posts} />
    </Suspense>
  )
}
```


그런 다음 클라이언트 컴포넌트에서 `use` API로 프라미스를 읽습니다.

```tsx filename="app/ui/posts.tsx" switcher
'use client'
import { use } from 'react'

export default function Posts({
  posts,
}: {
  posts: Promise<{ id: string; title: string }[]>
}) {
  const allPosts = use(posts)

  return (
    <ul>
      {allPosts.map((post) => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  )
}
```

위 예시에서 `<Posts>` 컴포넌트는 [`<Suspense>` 경계](https://react.dev/reference/react/Suspense)로 감싸져 있습니다. 즉, 프라미스가 해결되는 동안 폴백이 표시됩니다. [스트리밍](#스트리밍)에 대해 더 알아보세요.

프라미스는 서버에서 `await`로 해결할 수도 있고, 클라이언트 컴포넌트에서 `use()`로 해결할 수도 있습니다. [서버 컴포넌트와 클라이언트 컴포넌트 중 어디에서 프라미스를 해결해야 하는지](https://react.dev/reference/react/use#resolve-promise-in-server-or-client-component)는 React 문서에서 다룹니다. 하나의 프라미스를 여러 클라이언트 컴포넌트가 공유해야 한다면 prop으로 넘기는 대신 컨텍스트로 제공하세요. [컨텍스트 프로바이더 안에서 React의 `use` 사용하기](/docs/app/guides/single-page-applications#using-reacts-use-within-a-context-provider)를 참고하세요.

#### 커뮤니티 라이브러리

클라이언트 컴포넌트에서 데이터를 가져올 때 [SWR](https://swr.vercel.app/)이나 [React Query](https://tanstack.com/query/latest) 같은 커뮤니티 라이브러리를 사용할 수 있습니다. 이런 라이브러리들은 캐싱, 스트리밍 등에 대해 각자의 방식을 가지고 있습니다. 예를 들어 SWR은 다음과 같습니다.

```tsx filename="app/blog/page.tsx" switcher
'use client'
import useSWR from 'swr'

const fetcher = (url) => fetch(url).then((r) => r.json())

export default function BlogPage() {
  const { data, error, isLoading } = useSWR(
    'https://api.vercel.app/blog',
    fetcher
  )

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>

  return (
    <ul>
      {data.map((post: { id: string; title: string }) => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  )
}
```

브라우저에서 직접 데이터를 가져오는 방법, 서버 컴포넌트에서 초기 데이터를 제공하는 방법, 라이브러리 캐시를 Next.js의 서버·클라이언트 캐시와 맞추는 방법은 [클라이언트 사이드 데이터 가져오기](/docs/app/guides/client-side-data-fetching)를 참고하세요.

## 예시

### 순차적 데이터 가져오기

순차적 데이터 가져오기는 한 요청이 다른 요청의 데이터에 의존할 때 발생합니다.

예를 들어 `<Playlists>`는 `artistID`가 필요하므로 `getArtist()`가 해결된 뒤에야 데이터를 가져올 수 있습니다.

```tsx filename="app/artist/[username]/page.tsx" switcher
export default async function Page({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params
  // 아티스트 정보를 가져옵니다
  const artist = await getArtist(username)

  return (
    <>
      <h1>{artist.name}</h1>
      {/* Playlists 컴포넌트가 로딩되는 동안 폴백 UI를 보여줍니다 */}
      <Suspense fallback={<div>Loading...</div>}>
        {/* 아티스트 ID를 Playlists 컴포넌트로 전달합니다 */}
        <Playlists artistID={artist.id} />
      </Suspense>
    </>
  )
}

async function Playlists({ artistID }: { artistID: string }) {
  // 아티스트 ID로 플레이리스트를 가져옵니다
  const playlists = await getArtistPlaylists(artistID)

  return (
    <ul>
      {playlists.map((playlist) => (
        <li key={playlist.id}>{playlist.name}</li>
      ))}
    </ul>
  )
}
```

이 예시에서 `<Suspense>` 덕분에 아티스트 데이터가 로드된 뒤 플레이리스트가 스트리밍으로 들어옵니다. 하지만 페이지는 여전히 아티스트 데이터를 기다린 뒤에야 무언가를 표시합니다. 이를 막으려면 페이지 컴포넌트 전체를 `<Suspense>` 경계로 감싸서(예: [`loading.js` 파일](#loadingjs-사용하기) 사용) 로딩 상태를 즉시 보여줄 수 있습니다.

첫 번째 요청이 나머지 전부를 막기 때문에, 데이터 소스가 그 요청을 빠르게 처리할 수 있는지 확인하세요. 요청을 더 최적화할 수 없다면, 데이터가 자주 바뀌지 않는 경우 결과를 [캐싱](/docs/app/getting-started/caching)하는 것을 고려하세요.

### 병렬 데이터 가져오기

병렬 데이터 가져오기는 라우트 안의 데이터 요청들이 즉시 시작되어 동시에 진행될 때를 말합니다.

기본적으로 [레이아웃과 페이지](/docs/app/getting-started/layouts-and-pages)는 병렬로 렌더링됩니다. 따라서 각 세그먼트는 가능한 한 빨리 데이터 가져오기를 시작합니다.

하지만 *어떤* 컴포넌트 안에서든, 여러 `async`/`await` 요청을 나란히 배치하면 여전히 순차적으로 실행될 수 있습니다. 예를 들어 `getAlbums`는 `getArtist`가 해결될 때까지 막힙니다.

```tsx filename="app/artist/[username]/page.tsx" switcher
import { getArtist, getAlbums } from '@/app/lib/data'

export default async function Page({ params }) {
  // 이 요청들은 순차적으로 실행됩니다
  const { username } = await params
  const artist = await getArtist(username)
  const albums = await getAlbums(username)
  return <div>{artist.name}</div>
}
```

여러 요청을 시작하려면 `fetch`를 먼저 호출한 뒤 [`Promise.all`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all)로 기다리세요. 요청은 `fetch`가 호출되는 순간 시작됩니다.

```tsx filename="app/artist/[username]/page.tsx" highlight={3,8,24} switcher
import Albums from './albums'

async function getArtist(username: string) {
  const res = await fetch(`https://api.example.com/artist/${username}`)
  return res.json()
}

async function getAlbums(username: string) {
  const res = await fetch(`https://api.example.com/artist/${username}/albums`)
  return res.json()
}

export default async function Page({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params

  // 요청을 시작합니다
  const artistData = getArtist(username)
  const albumsData = getAlbums(username)

  const [artist, albums] = await Promise.all([artistData, albumsData])

  return (
    <>
      <h1>{artist.name}</h1>
      <Albums list={albums} />
    </>
  )
}
```

> **알아두기**: `Promise.all`을 사용할 때 요청 하나가 실패하면 전체 작업이 실패합니다. 이를 처리하려면 [`Promise.allSettled`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled) 메서드를 대신 사용할 수 있습니다.

### `React.cache`로 데이터 재사용하기

ORM이나 데이터베이스 쿼리처럼 `fetch`를 사용하지 않는 데이터 접근은 함수를 [`React.cache`](https://react.dev/reference/react/cache)로 감싸세요. 그러면 같은 요청 안에서 여러 컴포넌트가 그 함수를 호출하면서 하나의 결과를 공유할 수 있습니다.

```ts filename="app/lib/user.ts" switcher
import { cache } from 'react'
import { db, eq, users } from '@/lib/db'

export const getUser = cache(async (id: string) => {
  return db.query.users.findFirst({
    where: eq(users.id, id),
  })
})
```


서버 컴포넌트는 `getUser()`를 직접 호출할 수 있습니다.

```tsx filename="app/dashboard/page.tsx" switcher
import { getUser } from '../lib/user'

export default async function DashboardPage() {
  const user = await getUser('1')

  if (!user) {
    return null
  }

  return <h1>Dashboard for {user.name}</h1>
}
```

`getUser`가 `React.cache`로 감싸져 있으므로, 한 요청 안에서 같은 `id`로 호출하면 동일한 메모이제이션 결과를 반환합니다.

> **알아두기**: [`React.cache`](https://react.dev/reference/react/cache#caveats)는 현재 요청 범위로만 적용됩니다. 요청마다 각자의 메모이제이션 범위를 가지며 요청 간에는 공유되지 않습니다.

### 데이터 프리로딩

어떤 컴포넌트가 다른 블로킹 작업 뒤에 렌더링되면, 요청에 필요한 입력값이 이미 준비되어 있더라도 데이터 요청이 늦게 시작됩니다. 프리로딩은 요청을 더 일찍 시작해 그 작업과 병렬로 진행되게 하여 요청 워터폴을 피합니다.

데이터를 프리로드하려면 블로킹 작업 전에 데이터 가져오기 함수를 `await` 없이 호출하고, 결과를 소비하는 컴포넌트에서 같은 함수를 다시 호출하세요.

컴포넌트가 프리로딩으로 시작된 요청을 재사용할 수 있으려면, 데이터 가져오기 함수가 동일한 호출을 중복 제거해야 합니다. 다음 중 한 가지 방법을 사용하세요.

* `fetch`의 경우 [동일한 요청은 자동으로 메모이제이션됩니다](/docs/app/api-reference/functions/fetch#memoization).
* ORM이나 데이터베이스의 경우 데이터 가져오기 함수를 [`React.cache`](#reactcache로-데이터-재사용하기)로 감싸세요.
* Cache Components를 쓴다면 데이터 가져오기 함수에 [`'use cache'`](/docs/app/api-reference/directives/use-cache)를 추가하세요. 그 함수가 `cookies()`나 `headers()` 같은 요청 API를 읽는다면 [`'use cache: private'`](/docs/app/api-reference/directives/use-cache-private)를 사용하세요.

프로덕션에서는 private Cache Function에 대한 동일한 호출이 한 요청 안에서 같은 결과를 재사용할 수 있습니다. 덕분에 결과를 요청 간 서버 캐시에 저장하지 않고도 컴포넌트가 프리로딩으로 시작된 요청을 재사용할 수 있습니다.

프리로드 함수는 데이터를 소비하는 컴포넌트 옆에 두세요. 그러면 컴포넌트를 옮기거나 제거할 때 의존 관계를 찾기 쉬워집니다.

```tsx filename="app/item/[id]/item.tsx" switcher
async function getItem(id: string) {
  const res = await fetch(`https://api.example.com/items/${id}`)
  return res.json()
}

export const preload = (id: string) => {
  void getItem(id)
}

export default async function Item({ id }: { id: string }) {
  const item = await getItem(id)
  return <div>{item.name}</div>
}
```


아이템 로딩을 더 일찍 시작하려면 다른 블로킹 요청 전에 `preload()`를 호출하세요.

```tsx filename="app/item/[id]/page.tsx" switcher
import Item, { preload } from './item'
import { checkIsAvailable } from '@/app/lib/data'

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  preload(id)
  const isAvailable = await checkIsAvailable(id)

  return isAvailable ? <Item id={id} /> : null
}
```

`checkIsAvailable()`이 실행되는 동안 아이템 요청은 계속 진행됩니다. 페이지가 `<Item>`을 렌더링하면, 동일한 `fetch` 호출은 `preload()`가 시작해둔 요청을 재사용합니다.
