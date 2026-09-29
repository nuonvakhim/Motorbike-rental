
# 서버 컴포넌트와 클라이언트 컴포넌트
> 모든 Next.js 문서 목록은 [/docs/llms.txt](/docs/llms.txt)를 참고하세요.
기본적으로 레이아웃과 페이지는 [서버 컴포넌트](https://react.dev/reference/rsc/server-components)입니다. 덕분에 서버에서 데이터를 가져오고 UI의 일부를 렌더링하며, 필요하면 결과를 캐시하고 클라이언트로 스트리밍할 수 있습니다. 상호작용이나 브라우저 API가 필요할 때는 [클라이언트 컴포넌트](https://react.dev/reference/rsc/use-client)로 기능을 덧붙입니다.

꼭 기억할 점: **서버가 기본값입니다.** 서버 컴포넌트를 쓰겠다고 선택하는 것이 아니라, `'use client'`로 서버 컴포넌트에서 *빠져나오는* 것이며, 그것도 실제로 브라우저가 필요한 트리 부분에 한해서입니다.

## 서버 컴포넌트와 클라이언트 컴포넌트는 언제 쓰는가?

클라이언트 환경과 서버 환경은 서로 다른 기능을 제공합니다. 서버 컴포넌트와 클라이언트 컴포넌트를 사용하면 상황에 따라 각 환경에서 로직을 실행할 수 있습니다.

| 필요한 것 | 사용 |
| --------- | ---- |
| [상태](https://react.dev/learn/managing-state)와 [이벤트 핸들러](https://react.dev/learn/responding-to-events) — `onClick`, `onChange` | **클라이언트** |
| [생명주기 로직](https://react.dev/learn/lifecycle-of-reactive-effects) — `useEffect` | **클라이언트** |
| 브라우저 전용 API — `localStorage`, `window`, `navigator.geolocation` | **클라이언트** |
| [커스텀 훅](https://react.dev/learn/reusing-logic-with-custom-hooks) | **클라이언트** |
| 데이터베이스나 API에서 소스에 가깝게 데이터 가져오기 | **서버** |
| API 키, 토큰 등 시크릿을 클라이언트에 노출하지 않기 | **서버** |
| 브라우저로 전송되는 JavaScript 양 줄이기 | **서버** |
| [First Contentful Paint(FCP)](https://web.dev/fcp/) 개선과 콘텐츠 점진적 스트리밍 | **서버** |

예를 들어 `<Page>`는 글 데이터를 가져오는 서버 컴포넌트이고, 그 데이터를 props로 `<LikeButton>`에 넘겨 클라이언트 상호작용을 처리하게 합니다.

```tsx filename="app/[id]/page.tsx" highlight={1,17} switcher
import LikeButton from '@/app/ui/like-button'
import { getPost } from '@/lib/data'

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const post = await getPost(id)

  return (
    <div>
      <main>
        <h1>{post.title}</h1>
        {/* ... */}
        <LikeButton likes={post.likes} />
      </main>
    </div>
  )
}
```

```tsx filename="app/ui/like-button.tsx" highlight={1} switcher
'use client'

import { useState } from 'react'

export default function LikeButton({ likes }: { likes: number }) {
  // ...
}
```

## Next.js에서 서버 컴포넌트와 클라이언트 컴포넌트는 어떻게 동작하는가?

```
요청
  │
  ├─ 서버가 서버 컴포넌트를 렌더링   ──▶  RSC 페이로드
  │    (+ 클라이언트 컴포넌트의 자리 표시자와 JS 참조)
  │
  ├─ 서버가 RSC 페이로드 + 클라이언트 컴포넌트로  ──▶  HTML 프리렌더링
  │
  ▼
브라우저 (첫 로드)
  1. HTML         →  상호작용 없는 화면을 즉시 보여줌
  2. RSC 페이로드  →  서버·클라이언트 컴포넌트 트리를 대조
  3. JavaScript   →  클라이언트 컴포넌트를 하이드레이션해 상호작용 가능하게 만듦
```

### 서버에서

Next.js는 React의 API를 사용해 렌더링을 조율합니다. 렌더링 작업은 개별 라우트 세그먼트([레이아웃과 페이지](/docs/app/getting-started/layouts-and-pages)) 단위로 나뉘며, 화면에 표시되는지와 무관하게 [병렬 라우트 슬롯](/docs/app/api-reference/file-conventions/parallel-routes)도 포함됩니다.

* **서버 컴포넌트**는 React Server Component 페이로드(RSC 페이로드)라는 특별한 데이터 형식으로 렌더링됩니다.
* **클라이언트 컴포넌트**와 RSC 페이로드는 HTML을 [프리렌더링](/docs/app/glossary#prerendering)하는 데 사용됩니다.

> **React Server Component 페이로드(RSC)란?**
>
> RSC 페이로드는 렌더링된 React 서버 컴포넌트 트리를 압축해 직렬화한 표현입니다. React는 클라이언트에서 이를 사용해 브라우저 DOM을 갱신합니다. 페이로드에는 다음이 담깁니다.
>
> * 서버 컴포넌트의 렌더링 결과
> * 클라이언트 컴포넌트가 렌더링될 위치의 자리 표시자와 해당 JavaScript 파일 참조
> * 서버 컴포넌트에서 클라이언트 컴포넌트로 전달된 props

### 클라이언트에서 (첫 로드)

1. **HTML**로 사용자에게 상호작용이 없는 라우트 미리보기를 즉시 보여줍니다.
2. **RSC 페이로드**로 클라이언트와 서버 컴포넌트 트리를 대조합니다.
3. **JavaScript**로 클라이언트 컴포넌트를 하이드레이션해 애플리케이션을 상호작용 가능하게 만듭니다.

> **하이드레이션이란?** 하이드레이션은 정적 HTML을 상호작용 가능하게 만들기 위해 React가 DOM에 [이벤트 핸들러](https://react.dev/learn/responding-to-events)를 붙이는 과정입니다.

### 이후의 내비게이션

* **RSC 페이로드**는 즉각적인 내비게이션을 위해 미리 가져와 캐시됩니다.
* **클라이언트 컴포넌트**는 서버에서 렌더링된 HTML 없이 전적으로 클라이언트에서 렌더링됩니다.

## 클라이언트 컴포넌트 사용하기

파일 최상단, import 문보다 위에 [`"use client"`](https://react.dev/reference/rsc/use-client) 지시어를 추가하면 클라이언트 컴포넌트를 만들 수 있습니다.

```tsx filename="app/ui/counter.tsx" highlight={1} switcher
'use client'

import { useState } from 'react'

export default function Counter() {
  const [count, setCount] = useState(0)

  return (
    <div>
      <p>{count} likes</p>
      <button onClick={() => setCount(count + 1)}>Click me</button>
    </div>
  )
}
```

`"use client"`는 서버와 클라이언트 모듈 그래프(트리) 사이의 **경계**를 선언합니다. 파일에 `"use client"`가 표시되면 **그 파일이 import 하는 모든 것과 직접 렌더링하는 컴포넌트가 클라이언트 번들에 포함됩니다**. 따라서 클라이언트용으로 의도한 모든 컴포넌트마다 지시어를 추가할 필요는 없습니다.

```
app/layout.tsx              서버 컴포넌트
└── <Nav>                   서버 컴포넌트
    ├── <Logo>              서버 컴포넌트
    └── <Search>            'use client'  ◀── 경계
        ├── <SearchInput>   클라이언트 — 경계 아래에서 import 됨
        └── <SearchIcon>    클라이언트 — 경계 아래에서 import 됨
```

이는 클라이언트 컴포넌트의 [모듈 그래프](/docs/app/glossary#module-graph)에 속한 컴포넌트, 즉 그 컴포넌트가 import 하는 모듈과 직접 렌더링하는 컴포넌트에 적용됩니다. `children`이나 다른 props로 **전달된** 서버 컴포넌트에는 적용되지 **않습니다**. 그런 컴포넌트는 클라이언트 모듈 그래프에 import 되지 않으며, 서버에서 렌더링되어 그 결과물이 전달됩니다.

### JS 번들 크기 줄이기

클라이언트 JavaScript 번들 크기를 줄이려면 UI의 큰 영역을 클라이언트 컴포넌트로 지정하는 대신, 상호작용이 필요한 특정 컴포넌트에만 `'use client'`를 추가하세요.

예를 들어 `<Layout>`은 로고와 내비게이션 링크처럼 대부분 정적인 요소로 이루어져 있지만 상호작용하는 검색창을 포함합니다. 클라이언트 컴포넌트여야 하는 것은 `<Search />`뿐입니다.

```tsx filename="app/layout.tsx" highlight={12} switcher
// 클라이언트 컴포넌트
import Search from './search'
// 서버 컴포넌트
import Logo from './logo'

// Layout은 기본적으로 서버 컴포넌트입니다
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <nav>
        <Logo />
        <Search />
      </nav>
      <main>{children}</main>
    </>
  )
}
```

```tsx filename="app/ui/search.tsx" highlight={1} switcher
'use client'

export default function Search() {
  // ...
}
```

## 서버 컴포넌트에서 클라이언트 컴포넌트로 데이터 전달하기

props를 사용해 서버 컴포넌트에서 클라이언트 컴포넌트로 데이터를 전달할 수 있습니다.

```tsx filename="app/[id]/page.tsx" highlight={1,12} switcher
import LikeButton from '@/app/ui/like-button'
import { getPost } from '@/lib/data'

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const post = await getPost(id)

  return <LikeButton likes={post.likes} />
}
```
```tsx
'use client'
 
export default function LikeButton({ likes }: { likes: number }) {
  // ...
}
```


또는 [`use` API](https://react.dev/reference/react/use)를 사용해 서버 컴포넌트에서 클라이언트 컴포넌트로 데이터를 스트리밍할 수도 있습니다.

> **알아두기**: 클라이언트 컴포넌트로 전달하는 props는 React가 [직렬화](https://react.dev/reference/react/use-server#serializable-parameters-and-return-values)할 수 있어야 합니다. 함수, 클래스 인스턴스, `Date` 계열의 특수한 값은 경계를 넘지 못합니다.

## 서버 컴포넌트와 클라이언트 컴포넌트 섞어 쓰기

서버 컴포넌트를 클라이언트 컴포넌트의 prop으로 전달할 수 있습니다. 이렇게 하면 서버에서 렌더링된 UI를 클라이언트 컴포넌트 안에 시각적으로 중첩할 수 있습니다.

흔히 쓰이는 패턴은 `children`으로 클라이언트 컴포넌트 안에 *슬롯*을 만드는 것입니다. 예를 들어 서버에서 데이터를 가져오는 `<Cart>`를, 클라이언트 상태로 표시 여부를 토글하는 `<Modal>` 안에 넣는 식입니다.

```tsx filename="app/ui/modal.tsx" switcher
'use client'

export default function Modal({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>
}
```

그런 다음 부모 서버 컴포넌트에서 `<Cart>`를 `<Modal>`의 자식으로 전달합니다.

```tsx filename="app/page.tsx" highlight={7} switcher
import Modal from './ui/modal'
import Cart from './ui/cart'

export default function Page() {
  return (
    <Modal>
      <Cart />
    </Modal>
  )
}
```

이 패턴에서 서버 컴포넌트는 클라이언트 컴포넌트의 props로 전달되더라도 서버에서 미리 렌더링됩니다. RSC 페이로드에는 그 렌더링 결과와 함께, 클라이언트 컴포넌트의 자리 표시자 및 해당 JavaScript 파일 참조가 담깁니다.

> **기억할 규칙**: 클라이언트 컴포넌트는 서버 컴포넌트를 **import 할 수는 없지만**, `children`이나 props로 **전달받을 수는 있습니다**.

## 컨텍스트 프로바이더

[React 컨텍스트](https://react.dev/learn/passing-data-deeply-with-context)는 현재 테마처럼 전역 상태를 공유할 때 흔히 사용합니다. 하지만 React 컨텍스트는 **서버 컴포넌트에서 지원되지 않습니다**.

컨텍스트를 사용하려면 `children`을 받는 클라이언트 컴포넌트를 만드세요.

```tsx filename="app/theme-provider.tsx" switcher
'use client'

import { createContext } from 'react'

export const ThemeContext = createContext({})

export default function ThemeProvider({
  children,
}: {
  children: React.ReactNode
}) {
  return <ThemeContext.Provider value="dark">{children}</ThemeContext.Provider>
}
```

그런 다음 `layout` 같은 서버 컴포넌트에서 import 합니다.

```tsx filename="app/layout.tsx" switcher
import ThemeProvider from './theme-provider'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
```

이제 서버 컴포넌트가 프로바이더를 직접 렌더링할 수 있고, 앱 전체의 클라이언트 컴포넌트가 이 컨텍스트를 사용할 수 있습니다.

> **알아두기**: 프로바이더는 트리에서 가능한 한 깊은 곳에 렌더링하세요. `ThemeProvider`가 `<html>` 문서 전체가 아니라 `{children}`만 감싸고 있다는 점에 주목하세요. 이렇게 하면 Next.js가 서버 컴포넌트의 정적인 부분을 더 쉽게 최적화할 수 있습니다.

## 서드파티 컴포넌트

클라이언트 전용 기능에 의존하는 서드파티 컴포넌트를 사용할 때는, 정상적으로 동작하도록 클라이언트 컴포넌트로 감싸세요.

예를 들어 `acme-carousel` 패키지의 `<Carousel />`은 `useState`를 사용하지만 `"use client"` 지시어를 포함하고 있지 않습니다. 클라이언트 컴포넌트 *안에서* 사용하면 문제없이 동작합니다.

```tsx filename="app/gallery.tsx" switcher
'use client'

import { useState } from 'react'
import { Carousel } from 'acme-carousel'

export default function Gallery() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div>
      <button onClick={() => setIsOpen(true)}>View pictures</button>
      {/* 클라이언트 컴포넌트 안에서 사용하므로 정상 동작합니다 */}
      {isOpen && <Carousel />}
    </div>
  )
}
```

반면 서버 컴포넌트 안에서 직접 사용하면 오류가 납니다. Next.js는 `<Carousel />`이 클라이언트 전용 기능을 쓴다는 사실을 알 수 없기 때문입니다. 해결책은 직접 만든 한 줄짜리 래퍼입니다.

```tsx filename="app/carousel.tsx" switcher
'use client'

import { Carousel } from 'acme-carousel'

export default Carousel
```

이제 `<Carousel />`을 서버 컴포넌트 안에서 바로 사용할 수 있습니다.
```tsx
import Carousel from './carousel'
 
export default function Page() {
  return (
    <div>
      <p>View pictures</p>
      {/*  Carousel이 클라이언트 컴포넌트이므로 정상 동작합니다 */}
      <Carousel />
    </div>
  )
}
```

> **라이브러리 제작자를 위한 조언**: 컴포넌트 라이브러리를 만들고 있다면, 클라이언트 전용 기능에 의존하는 진입점에 `"use client"` 지시어를 추가하세요. 그러면 사용자가 래퍼를 만들지 않고도 서버 컴포넌트에서 컴포넌트를 import 할 수 있습니다. 일부 번들러는 `"use client"` 지시어를 제거하기도 하므로 빌드 설정을 확인하세요.

## 환경 오염 방지하기

JavaScript 모듈은 서버 컴포넌트와 클라이언트 컴포넌트 모듈 양쪽에서 공유될 수 있습니다. 즉, 서버 전용 코드를 실수로 클라이언트에 import 할 수 있다는 뜻입니다. 다음 코드를 보세요.

```ts filename="lib/data.ts" switcher
export async function getData() {
  const res = await fetch('https://external-service.com/data', {
    headers: {
      authorization: process.env.API_KEY,
    },
  })

  return res.json()
}
```

이 함수는 절대 클라이언트에 노출되어서는 안 되는 `API_KEY`를 읽습니다.

Next.js에서는 `NEXT_PUBLIC_` 접두사가 붙은 환경 변수만 클라이언트 번들에 포함됩니다. 접두사가 없는 변수는 빈 문자열로 치환되므로 `getData()`는 키를 유출하는 대신 조용히 실패합니다. 하지만 조용한 실패는 믿고 의지할 만한 안전장치가 아닙니다.

클라이언트 컴포넌트에서 실수로 사용하는 것을 막으려면 [`server-only` 패키지](https://www.npmjs.com/package/server-only)를 사용하세요.

```js filename="lib/data.js"
import 'server-only'

export async function getData() {
  // ...
}
```

이제 해당 모듈을 클라이언트 컴포넌트에 import 하면 런타임에 조용히 잘못 동작하는 대신 **빌드 시점**에 실패합니다. 대응되는 [`client-only` 패키지](https://www.npmjs.com/package/client-only)는 `window`를 다루는 코드처럼 클라이언트 전용 로직이 담긴 모듈을 표시하는 데 사용합니다.

```bash package="npm"
npm install server-only
```

`server-only`나 `client-only` 설치는 **선택 사항**입니다. Next.js는 더 명확한 오류 메시지를 제공하기 위해 이 import들을 내부적으로 처리하며, 자체 타입 선언도 함께 제공합니다. 린트 규칙이 미선언 의존성을 문제 삼는 경우에만 설치하세요.

---

