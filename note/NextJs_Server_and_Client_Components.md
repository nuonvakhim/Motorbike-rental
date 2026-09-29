
# Server and Client Components
> For an index of all Next.js documentation, see [/docs/llms.txt](/docs/llms.txt).
By default, layouts and pages are [Server Components](https://react.dev/reference/rsc/server-components), which lets you fetch data and render parts of your UI on the server, optionally cache the result, and stream it to the client. When you need interactivity or browser APIs, you can use [Client Components](https://react.dev/reference/rsc/use-client) to layer in functionality.

The important thing to hold onto: **Server is the default.** You do not opt into Server Components — you opt *out* of them with `'use client'`, and only for the parts of the tree that genuinely need the browser.

## When to use Server and Client Components?

The client and server environments have different capabilities. Server and Client Components let you run logic in each environment depending on your use case.

| What you need | Use |
| ------------- | --- |
| [State](https://react.dev/learn/managing-state) and [event handlers](https://react.dev/learn/responding-to-events) — `onClick`, `onChange` | **Client** |
| [Lifecycle logic](https://react.dev/learn/lifecycle-of-reactive-effects) — `useEffect` | **Client** |
| Browser-only APIs — `localStorage`, `window`, `navigator.geolocation` | **Client** |
| [Custom hooks](https://react.dev/learn/reusing-logic-with-custom-hooks) | **Client** |
| Fetching data from a database or API close to the source | **Server** |
| API keys, tokens, and other secrets kept off the client | **Server** |
| Reducing the amount of JavaScript sent to the browser | **Server** |
| Improving [First Contentful Paint (FCP)](https://web.dev/fcp/) and streaming content progressively | **Server** |

For example, `<Page>` is a Server Component that fetches a post and passes the data as props to `<LikeButton>`, which handles the client-side interactivity:

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

## How do Server and Client Components work in Next.js?

```
Request
  │
  ├─ Server renders Server Components   ──▶  RSC Payload
  │    (+ placeholders and JS references for Client Components)
  │
  ├─ Server uses RSC Payload + Client Components  ──▶  prerendered HTML
  │
  ▼
Browser (first load)
  1. HTML         →  instant, non-interactive preview of the route
  2. RSC Payload  →  reconcile the Server and Client Component trees
  3. JavaScript   →  hydrate Client Components, making the page interactive
```

### On the server

Next.js uses React's APIs to orchestrate rendering. The work is split into chunks by individual route segments ([layouts and pages](/docs/app/getting-started/layouts-and-pages)), including [parallel route slots](/docs/app/api-reference/file-conventions/parallel-routes) whether or not they are displayed:

* **Server Components** are rendered into a special data format called the React Server Component Payload (RSC Payload).
* **Client Components** and the RSC Payload are used to [prerender](/docs/app/glossary#prerendering) HTML.

> **What is the React Server Component Payload (RSC)?**
>
> The RSC Payload is a compact, serialized representation of the rendered React Server Components tree. React uses it on the client to update the browser's DOM. It contains:
>
> * The rendered result of Server Components
> * Placeholders for where Client Components should be rendered, and references to their JavaScript files
> * Any props passed from a Server Component to a Client Component

### On the client (first load)

1. **HTML** is used to immediately show a fast non-interactive preview of the route to the user.
2. **RSC Payload** is used to reconcile the Client and Server Component trees.
3. **JavaScript** is used to hydrate Client Components and make the application interactive.

> **What is hydration?** Hydration is React's process for attaching [event handlers](https://react.dev/learn/responding-to-events) to the DOM, to make the static HTML interactive.

### Subsequent navigations

* The **RSC Payload** is prefetched and cached for instant navigation.
* **Client Components** are rendered entirely on the client, without the server-rendered HTML.

## Using Client Components

You can create a Client Component by adding the [`"use client"`](https://react.dev/reference/rsc/use-client) directive at the top of the file, above your imports.

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

`"use client"` declares a **boundary** between the Server and Client module graphs (trees). Once a file is marked with `"use client"`, **all of its imports and the components it directly renders are included in the client bundle** — so you don't need to add the directive to every component intended for the client.

```
app/layout.tsx              Server Component
└── <Nav>                   Server Component
    ├── <Logo>              Server Component
    └── <Search>            'use client'  ◀── boundary
        ├── <SearchInput>   Client — imported below the boundary
        └── <SearchIcon>    Client — imported below the boundary
```

This applies to components in the Client Component's [module graph](/docs/app/glossary#module-graph) — the modules it imports and the components it renders directly. It does **not** apply to Server Components passed as `children` or other props: those are not imported into the client module graph. They are rendered on the server and passed in as rendered output.

### Reducing JS bundle size

To reduce the size of your client JavaScript bundles, add `'use client'` to specific interactive components instead of marking large parts of your UI as Client Components.

For example, `<Layout>` is mostly static — a logo and navigation links — but includes an interactive search bar. Only `<Search />` needs to be a Client Component:

```tsx filename="app/layout.tsx" highlight={12} switcher
// Client Component
import Search from './search'
// Server Component
import Logo from './logo'

// Layout is a Server Component by default
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

## Passing data from Server to Client Components

You can pass data from Server Components to Client Components using props.

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


Alternatively, you can stream data from a Server Component to a Client Component with the [`use` API](https://react.dev/reference/react/use).

> **Good to know**: Props passed to Client Components need to be [serializable](https://react.dev/reference/react/use-server#serializable-parameters-and-return-values) by React. Functions, class instances, and `Date`-adjacent exotics won't cross the boundary.

## Interleaving Server and Client Components

You can pass Server Components as a prop to a Client Component. This lets you visually nest server-rendered UI inside Client Components.

A common pattern is to use `children` to create a *slot* in a Client Component — for example a `<Cart>` that fetches data on the server, placed inside a `<Modal>` that uses client state to toggle visibility.

```tsx filename="app/ui/modal.tsx" switcher
'use client'

export default function Modal({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>
}
```

Then, in a parent Server Component, pass `<Cart>` as the child of `<Modal>`:

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

In this pattern, Server Components are rendered on the server ahead of time, even though they are passed as props to a Client Component. The RSC Payload carries their rendered result, plus placeholders for the Client Components and references to their JavaScript files.

> **The rule to remember**: a Client Component cannot **import** a Server Component, but it can **receive** one as `children` or props.

## Context providers

[React context](https://react.dev/learn/passing-data-deeply-with-context) is commonly used to share global state like the current theme. However, React context is **not supported in Server Components**.

To use context, create a Client Component that accepts `children`:

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

Then import it into a Server Component such as a `layout`:

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

Your Server Component can now render the provider directly, and Client Components throughout the app can consume the context.

> **Good to know**: Render providers as deep in the tree as possible — notice `ThemeProvider` wraps only `{children}` rather than the entire `<html>` document. This makes it easier for Next.js to optimize the static parts of your Server Components.

## Third-party components

When using a third-party component that relies on client-only features, wrap it in a Client Component to ensure it works as expected.

For example, `<Carousel />` from the `acme-carousel` package uses `useState`, but doesn't ship the `"use client"` directive. Used *inside* a Client Component, it works fine:

```tsx filename="app/gallery.tsx" switcher
'use client'

import { useState } from 'react'
import { Carousel } from 'acme-carousel'

export default function Gallery() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div>
      <button onClick={() => setIsOpen(true)}>View pictures</button>
      {/* Works, since Carousel is used within a Client Component */}
      {isOpen && <Carousel />}
    </div>
  )
}
```

Used directly inside a Server Component it errors, because Next.js doesn't know `<Carousel />` uses client-only features. The fix is a one-line wrapper of your own:

```tsx filename="app/carousel.tsx" switcher
'use client'

import { Carousel } from 'acme-carousel'

export default Carousel
```

Now `<Carousel />` can be used directly within a Server Component.
```tsx
import Carousel from './carousel'
 
export default function Page() {
  return (
    <div>
      <p>View pictures</p>
      {/*  Works, since Carousel is a Client Component */}
      <Carousel />
    </div>
  )
}
```

> **Advice for library authors**: If you're building a component library, add the `"use client"` directive to entry points that rely on client-only features. This lets your users import components into Server Components without writing wrappers. Note that some bundlers strip `"use client"` directives — check your build config.

## Preventing environment poisoning

JavaScript modules can be shared between Server and Client Component modules, which means it's possible to accidentally import server-only code into the client. Consider:

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

This function reads an `API_KEY` that should never reach the client.

In Next.js, only environment variables prefixed with `NEXT_PUBLIC_` are included in the client bundle. Unprefixed variables are replaced with an empty string, so `getData()` would silently fail rather than leak the key — but silent failure is not a safeguard you want to rely on.

To prevent accidental usage in Client Components, use the [`server-only` package](https://www.npmjs.com/package/server-only):

```js filename="lib/data.js"
import 'server-only'

export async function getData() {
  // ...
}
```

Importing that module into a Client Component now fails at **build time** instead of silently misbehaving at runtime. The matching [`client-only` package](https://www.npmjs.com/package/client-only) marks modules containing client-only logic, such as code that touches `window`.

```bash package="npm"
npm install server-only
```

Installing `server-only` or `client-only` is **optional** — Next.js handles these imports internally to provide clearer error messages, and ships its own type declarations for them. Install them only if your linting rules flag extraneous dependencies.

---


