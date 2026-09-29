# Rendering

Rendering is the work of turning a component tree into HTML. In the App Router that work is split across three moments: **build time**, **request time**, and **the browser**. This note covers where each part of a page is rendered, how Next.js decides, and how the result reaches the browser as a stream.

> **Note on the docs:** this version of Next.js has no single "Rendering" page. The model is described across [Rendering Philosophy](/docs/app/guides/rendering-philosophy), [Streaming](/docs/app/guides/streaming), [Caching](/docs/app/getting-started/caching), and the [Glossary](/docs/app/glossary). This note pulls those together.

## Where rendering happens

| Moment | What happens | Output |
| --- | --- | --- |
| **Build time** (`next build`) | Components that don't depend on request data are **prerendered** | HTML + RSC payload, cacheable on a CDN |
| **Request time** | Components that read request data, or do uncached async work, render per request | HTML chunks streamed into the open response |
| **Browser** | React **hydrates** the streamed HTML and takes over interaction | An interactive page |

Two pairs of names mean the same thing, and both appear in the docs:

* **Prerendering** = **static rendering**: the component is rendered at build time, or in the background during [revalidation](/docs/app/glossary#revalidation). The result is HTML plus an [RSC payload](/docs/app/getting-started/server-and-client-components#on-the-server), which can be cached and served from a CDN. This is the default for components that don't use request-time APIs.
* **Dynamic rendering** = **runtime rendering**: the component is rendered at request time instead, because it needs something that only exists once a request arrives.

**Hydration** is what happens after the HTML lands: React attaches event handlers to the server-rendered DOM and reconciles the markup with the client-side JavaScript, making static HTML interactive.

## Static and dynamic as a spectrum

Most web frameworks draw a hard line between static and dynamic **at the route level**. A page is either prerendered at build time or server-rendered at request time. This is simple to understand and simple to deploy: static files go to a CDN, dynamic routes point at a server.

Next.js takes a different approach: **the boundary between static and dynamic is at the component level, not the route level.** A single page can have a static shell that loads instantly and dynamic sections that stream in as they resolve. A cached function can live inside a dynamic route. A static page can be updated without a redeploy.

This is what Partial Prerendering, [Cache Components](/docs/app/getting-started/caching) (`use cache`), and on-demand revalidation enable together. They are not separate incremental features: they are one rendering model that treats static and dynamic as a spectrum rather than a binary choice.

### The three models compared

| Model | Boundary | Deployment | Cost |
| --- | --- | --- | --- |
| **Build-time prerendering** | Whole app | Static files on any CDN or file server, zero runtime infrastructure | Every content change needs a rebuild and redeploy; dynamic content must be fetched on the client after load |
| **Route-level boundaries** | Per route | Static files to a CDN, dynamic routes to a server | All-or-nothing per route: a mostly-static page with one live element must go fully dynamic or fetch that element on the client |
| **Component-level boundaries** (Next.js) | Per component | Static and dynamic content coexist in a single streaming response | Infrastructure complexity moves from application code into the hosting platform |

### What the component-level model enables

* **Faster perceived load times.** The static shell renders immediately while dynamic content streams in. Users see useful content right away instead of waiting for the whole page.
* **Incremental caching.** Caching and revalidation can be added gradually, without deciding at build time whether a route is static or dynamic. Any page can be revalidated on demand, and any function can be cached with [`use cache`](/docs/app/api-reference/directives/use-cache).
* **Granular caching.** Cache a function, not a route. Revalidate a [tag](/docs/app/api-reference/functions/revalidateTag), not a deployment. An expensive database query can be cached independently of the rest of the page.

## What makes a component dynamic

A component renders at request time when it touches something that only exists per request:

* **Request-time APIs** — [`cookies()`](/docs/app/api-reference/functions/cookies), [`headers()`](/docs/app/api-reference/functions/headers), [`searchParams`](/docs/app/api-reference/file-conventions/page#searchparams-optional), [`draftMode()`](/docs/app/api-reference/functions/draft-mode), and `params` that were not listed by [`generateStaticParams`](/docs/app/api-reference/functions/generate-static-params).
* **Uncached async work** — a `fetch` to an API, a database query, or any other async operation that is not wrapped in [`use cache`](/docs/app/api-reference/directives/use-cache).
* **Non-deterministic values** — `Math.random()`, `Date.now()`, `new Date()`. These cannot be frozen into a prerender, so they need either `connection()` inside a `<Suspense>` boundary (a fresh value per request) or `use cache` (one value shared across users).

By contrast, module imports, `fs.readFileSync`, and pure computations complete during prerendering and end up in the static shell automatically.

**The rule that ties this together:** when the prerenderer meets dynamic work, it walks **up** the tree looking for the nearest `<Suspense>` boundary to use as the fallback. Everything above that boundary is prerendered; the boundary's content streams at request time. If no boundary is found, the build fails with a [blocking route error](/docs/messages/blocking-prerender-dynamic).

So the developer's two real decisions are: **what to cache**, and **where to put the Suspense boundaries**.

## Vocabulary

| Term | Meaning |
| --- | --- |
| **Prerendering** / Static rendering | Rendering at build time (or during background revalidation). Produces HTML + RSC payload. |
| **Dynamic rendering** / Runtime rendering | Rendering at request time, triggered by request-time APIs or uncached async work. |
| **Static shell** | The prerendered HTML served immediately: layouts, navigation, and the Suspense fallbacks for whatever streams in later. |
| **App Shell** | The per-route prerender that contains only the parts not depending on URL data. Used as the default prefetch payload and as the ISR fallback for params not known at build time. |
| **Partial Prerendering (PPR)** | Prerendering and dynamic rendering combined in one route: shell first, dynamic content streamed after. The default with Cache Components. |
| **Streaming** | Sending parts of the page as they become ready instead of waiting for the whole render. |
| **Suspense boundary** | A React `<Suspense>` component. In Next.js it marks where the static shell ends and streaming begins. |
| **RSC payload** | A compact binary representation of the rendered Server Component tree: rendered Server Component output, placeholders for Client Components, and the props passed between them. |
| **Hydration** | React attaching event handlers to server-rendered HTML to make it interactive. |
| **ISR** | Updating prerendered content without rebuilding the whole site. Also called revalidation. |

Details of `use cache`, `cacheLife`, the static shell and prefetching live in the [Caching](/docs/app/getting-started/caching) guide; this note assumes them and focuses on the rendering and delivery side.

## How the App Router delivers a page

In traditional server-side rendering, the server produces the full HTML document before sending anything, so a single slow database query blocks the entire page. Streaming changes this by using [chunked transfer encoding](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Transfer-Encoding) to send parts of the response as they become ready. The browser starts rendering HTML while the server is still generating the rest.

React's server renderer produces HTML in chunks aligned with `<Suspense>` boundaries, and the App Router integrates this so streaming works without configuration. Two streams work together during an initial page load.

### The HTML stream

React's server renderer produces progressive HTML chunks. The static parts of the page (layouts, navigation, Suspense fallbacks) render first and are sent immediately. When a boundary's content is ready, for example when an async Server Component resolves, React streams its completed HTML along with two inline `<script>` tags: one that swaps the fallback DOM node for the new content, and one carrying the component payload so React can hydrate it later. The browser performs the swap instantly, without waiting for the JavaScript bundle or for hydration. This is what the user *sees*: the page painting section by section.

### The component payload

The component payload is a serialized representation of the component tree that React uses to hydrate the page and handle client-side updates. On initial load it arrives embedded in the HTML stream. On **client-side navigation** only the component payload is fetched (with an `rsc: 1` request header) and no HTML is transferred at all — React updates the component tree in place.

### The static shell

Everything that renders before any async work resolves is the **static shell**: layouts, navigation, and the fallback UI defined by the Suspense boundaries. It is sent immediately, giving the user something to see and interact with while dynamic content streams in. With [Cache Components](/docs/app/getting-started/caching), the static shell is prerendered at build time and served instantly from the edge.

![How Server Rendering with Streaming Works](https://h8DxKfmAPhn8O0p3.public.blob.vercel-storage.com/docs/light/server-rendering-with-streaming.png)

Each `<Suspense>` boundary is an independent streaming point. Components inside different boundaries resolve and stream in independently and do not block each other.

## Page-level streaming with `loading.js`

The simplest way to add streaming is a `loading.js` file next to `page.js`. Next.js automatically wraps the page content in a `<Suspense>` boundary and uses the loading component as the fallback.

![loading.js special file](https://h8DxKfmAPhn8O0p3.public.blob.vercel-storage.com/docs/light/loading-special-file.png)

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

Behind the scenes, `loading.js` is nested inside `layout.js` and wraps `page.js` in a `<Suspense>` boundary:

![loading.js overview](https://h8DxKfmAPhn8O0p3.public.blob.vercel-storage.com/docs/light/loading-overview.png)

This means:

* The layout renders immediately as part of the static shell.
* The loading skeleton is shown instantly as the Suspense fallback.
* When the page component finishes, its HTML replaces the skeleton.

`loading.js` is the right tool when there is nothing meaningful to show until the page's data resolves. See the [`loading.js` API reference](/docs/app/api-reference/file-conventions/loading) for details.

## Granular streaming with `<Suspense>`

`<Suspense>` controls exactly which parts of the page stream independently. Instead of a full-page skeleton, fallbacks are pushed down into specific sections so the static shell contains more real content.

### Parallel streaming with sibling boundaries

When several components do async work, wrap each one in its own boundary. Each streams as its own work completes, in whatever order that happens:

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

If `Revenue` resolves in 200ms, `RecentOrders` in 1s and `Recommendations` in 3s, the user sees each section appear as soon as its data is ready.

### Nested boundaries for progressive detail

Boundaries can be nested to create a layered reveal — header first, product details next, reviews last:

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

The outer boundary shows "Loading product details..." until `ProductDetails` resolves. Only then does the inner boundary become visible, showing "Loading reviews..." until `Reviews` resolves.

### Push dynamic access down

The key to maximizing what streams instantly is to defer dynamic data access to the component that actually needs it. This applies to `params`, `searchParams`, `cookies()`, `headers()` and data fetches alike. **If any of these is awaited at the top of a layout or page, everything below that point becomes dynamic and cannot be prerendered as part of the static shell.**

Instead, start the work but pass the promise down, and let the consuming component resolve it inside a boundary:

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
  const cookieStore = cookies() // Start the work, but don't await

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

`<Nav>` and `{children}` render as part of the static shell because nothing in the layout awaits. Only `<UserMenu>` suspends, when it resolves the cookie promise. Had the layout called `await cookies()` at the top, the entire layout and all its children would have been blocked from prerendering.

The same applies to `params` and `searchParams` — pass the promise to the component that needs the value rather than destructuring at the page level:

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

`<Hero />` paints as part of the static shell; `<ProductGrid>` resolves `params` when it needs the category, suspending only within its boundary.

The promise can also be unwrapped inline with `.then()`, so the child receives a plain value instead of a promise:

```tsx filename="app/shop/[category]/page.tsx" switcher
<Suspense fallback={<p>Loading products...</p>}>
  {params.then(({ category }) => (
    <ProductGrid category={category} />
  ))}
</Suspense>
```

This keeps `ProductGrid` simple (it takes a `string`, not a `Promise`) while still deferring the access to inside the boundary.

### When to use `loading.js` vs `<Suspense>`

|  | `loading.js` | `<Suspense>` |
| --- | --- | --- |
| **Scope** | Entire page | Any component |
| **Setup** | Drop in a file | Wrap components explicitly |
| **Navigation** | Prefetched as instant fallback | Not prefetched by default |
| **Best for** | Pages where nothing renders without data | Most pages, for granular control |

Prefer explicit `<Suspense>` boundaries close to the dynamic access. Because the prerenderer walks up to the *nearest* boundary, a `loading.js` high in the tree is a valid one — the framework finds it and stops there, and the whole page falls back to a full-page skeleton instead of streaming granularly.

### Error handling mid-stream

If a component throws after streaming has started, the nearest [`error.js`](/docs/app/api-reference/file-conventions/error) boundary catches it and renders the error UI in place of the failed component. The rest of the page stays intact; only the section that errored is replaced.

Because `200 OK` was already sent with the first chunk, the status cannot be changed to a `4xx` or `5xx`. The error is handled entirely inside the streamed HTML — see [The HTTP contract](#the-http-contract).

## Streaming data to the client

A fetch can be started in a Server Component and the unresolved promise passed as a prop to a Client Component. The promise can be passed through as many layers as needed; only the component that reads it with React's [`use`](https://react.dev/reference/react/use) API needs a `<Suspense>` boundary around it:

```tsx filename="app/dashboard/page.tsx" switcher
import { Suspense } from 'react'
import { StatsChart } from './stats-chart'

type Stats = { revenue: number; orders: number }

async function getStats(): Promise<Stats> {
  const res = await fetch('https://api.example.com/stats')
  return res.json()
}

export default function Dashboard() {
  // Start the fetch during server render, don't await it
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

  return <div>{/* render chart with stats */}</div>
}
```

The fallback is sent immediately with the static shell. When the promise resolves, React streams the completed HTML into the page.

### Sharing a promise across the tree

When several components need the same data, start the fetch once and pass the promise through a context provider, so any component in the subtree can resolve it with `use()`:

```tsx filename="app/layout.tsx"
import { getUser } from '@/lib/data'
// Stores the promise in React context for the subtree
import { UserProvider } from './user-provider'

export default function Layout({ children }: { children: React.ReactNode }) {
  const userPromise = getUser()

  return <UserProvider userPromise={userPromise}>{children}</UserProvider>
}
```

See [Using React's `use` within a Context Provider](/docs/app/guides/single-page-applications#using-reacts-use-within-a-context-provider) for the full pattern.

## Streaming in Route Handlers

The patterns above rely on React and Suspense to stream UI. Outside of React rendering, [Route Handlers](/docs/app/api-reference/file-conventions/route) can stream raw responses with the Web Streams API — useful for Server-Sent Events, large file generation, or any response that should arrive progressively:

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

Visiting the route with `curl http://localhost:3000/api/stream` shows the chunks arriving one at a time.

Files can also be streamed without loading them fully into memory, using `FileHandle.readableWebStream()`:

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

## Rendering and Web Vitals

[Web Vitals](https://web.dev/articles/vitals) are the metrics Google uses to measure user experience, and streaming affects several of them directly.

### TTFB and FCP

Without streaming, the server waits for all data before sending any HTML, so TTFB equals the slowest query. With streaming, the static shell is sent as soon as it is ready, so TTFB drops to the time it takes to render layouts and fallbacks. The browser paints the shell immediately, which decouples FCP from data fetching time.

### LCP (Largest Contentful Paint)

If the LCP element (a hero image, a main heading, a product photo) sits inside a Suspense boundary, it cannot paint until that boundary's content is swapped in. Revealing it also costs something on the client, because React streams a small inline script alongside the boundary's HTML and the content only appears once that script runs.

Data fetching is not the only reason a boundary delays the LCP element. React also holds back a large boundary, because sending its HTML takes time. See [what activates a Suspense boundary](https://react.dev/reference/react/Suspense#what-activates-a-suspense-boundary).

> **Good to know:** as a rule of thumb, if there is a Suspense boundary, React might use it. Under a slow network or a busy CPU, concurrent rendering can fall back to it even when you did not expect it. Adding a boundary means accepting that, so don't add one you don't need.

To keep LCP fast:

* Keep LCP elements **outside** or **above** Suspense boundaries so they render as part of the static shell.
* Use the [`preload`](/docs/app/api-reference/components/image#preload) prop on `next/image` for LCP images. It injects a `<link rel="preload">` into the `<head>`, so the browser starts fetching the image from the very first chunk, before the `<img>` tag appears in the HTML. It controls when the image is *fetched*, not when it paints — an image inside a boundary still waits for the swap.
* Render non-image LCP elements (text, headings) outside Suspense boundaries.

### CLS (Cumulative Layout Shift)

When a fallback is replaced by the resolved content, the browser reflows. If the two differ in size, the surrounding layout shifts. To minimize CLS, design skeletons that **match the dimensions** of the content they represent, and use fixed or min-height containers around boundaries so the space is reserved before content arrives.

### INP (Interaction to Next Paint)

Streaming enables [selective hydration](https://react.dev/reference/react-dom/client/hydrateRoot): React hydrates components independently as they stream in and prioritizes whatever the user is interacting with. **Each `<Suspense>` boundary is a hydration unit.** Without boundaries, React hydrates the entire page in one blocking pass; with them, hydration is broken into smaller tasks that yield to the browser and keep the main thread responsive.

### Early resource discovery

The static shell includes `<link>` and `<script>` tags in the very first HTML chunk, so the browser discovers and starts fetching CSS, JavaScript and fonts while the server is still generating content. Resources are fetched *during* server think time rather than after it.

In the dashboard example above, the `<h1>` renders in the shell (good for LCP), each data section streams behind its own boundary (good for INP, since hydration is split), and the skeleton fallbacks reserve space (good for CLS).

## The HTTP contract

Once streaming begins, the response headers — including the status code — have already been sent. **The status code and headers cannot be changed after streaming starts.** Everything in this section follows from that one constraint.

### Status codes

When a Suspense fallback renders or a component suspends, the server must commit to `200 OK` in order to start sending HTML. If [`notFound()`](/docs/app/api-reference/functions/not-found) fires mid-stream, Next.js cannot go back and change the status to 404; instead it injects `<meta name="robots" content="noindex">` into the streamed HTML so search engines don't index the page. Likewise, a [`redirect()`](/docs/app/api-reference/functions/redirect) mid-stream becomes a client-side redirect rather than an HTTP redirect header.

### When does streaming start?

The response body begins streaming when a Suspense fallback renders (for example a `loading.tsx`) or when a component suspends under a boundary. To get a real HTTP status code for errors, call `notFound()` **before** any `await` or Suspense boundary:

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
  const exists = await checkSlugExists(slug) // Fast existence check
  if (!exists) notFound() // Real 404, before any Suspense boundary

  return (
    <Suspense fallback={<p>Loading post...</p>}>
      <PostContent slug={slug} />
    </Suspense>
  )
}
```

> **Good to know:** requests can also be rejected early with [`proxy`](/docs/app/api-reference/file-conventions/proxy) (redirects, rewrites, or returning a response) or [`next.config.js` redirects](/docs/app/api-reference/config/next-config-js/redirects). Both run before the page renders, so HTTP status codes are still available.

### Bots and crawlers

HTML-limited bots and crawlers need metadata in the `<head>` of the initial HTML. Next.js detects them by user agent and waits for [`generateMetadata`](/docs/app/api-reference/functions/generate-metadata) to resolve before streaming the page content. Full browsers and DOM-capable crawlers receive [streaming metadata](/docs/app/api-reference/functions/generate-metadata#streaming-metadata) alongside the page content instead. Which bots get blocking metadata is configurable with [`htmlLimitedBots`](/docs/app/api-reference/config/next-config-js/htmlLimitedBots).

With [Cache Components](/docs/app/getting-started/caching), visitors and DOM-capable crawlers receive the prerendered shell immediately while dynamic content streams in, but HTML-limited bots **skip the prerendered shell** and render the page dynamically so metadata can be placed in the `<head>`.

This has a practical consequence worth remembering: if the shell depends on inputs that only exist while prerendering — build-time data, or values unreachable in the request-time environment — a page that loads fine for a person can fail to render for a crawler, because the bot re-runs that code at request time. Make sure any data the shell relies on is also available at request time.

## What can affect streaming

Any layer between the server and the client that buffers the response diminishes the benefit. The HTML may be generated progressively, but if a proxy, CDN or the client collects all chunks before rendering them, the user sees a single delayed response.

| Layer | What to watch for |
| --- | --- |
| **Reverse proxies** | Nginx and similar buffer by default. Disable it by sending the `X-Accel-Buffering: no` header. |
| **CDNs** | Some buffer entire responses before forwarding. Check whether chunked responses pass through, and on which plan tier. |
| **Serverless platforms** | Not all support streaming. AWS Lambda requires response streaming mode to be enabled explicitly; Vercel supports it natively. |
| **Compression** | Gzip and Brotli buffer internally before flushing, which can delay the first visible chunk. |
| **Clients** | Safari/WebKit buffers until 1024 bytes have arrived, so tiny responses paint all at once. `curl` buffers too — `-N` disables it, but it still flushes on newlines. |

The `X-Accel-Buffering` header can be set globally in the config:

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

### Verifying that streaming works

**Check the Network tab.** In Chrome DevTools, select the document request and look at the Timing breakdown. A long "Content Download" phase with an early "Time to First Byte" confirms the response is streaming rather than arriving all at once.

**Observe raw chunks.** Reading the response as a stream is more reliable than `curl`, which has its own buffering:

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

For a page with two sibling boundaries, the output looks like this:

```text filename="Terminal"
chunk 0 (+0ms)    # Static shell: <head>, CSS, nav, fallback skeletons,
                  # <template id="B:0"> and <template id="B:1"> placeholders,
                  # bootstrap scripts
chunk 1 (+170ms)  # Component payload (self.__next_f.push) for hydration
chunk 2 (+1000ms) # First boundary: payload + <div hidden id="S:0"> (swaps B:0)
chunk 3 (+3000ms) # Second boundary: payload + <div hidden id="S:1"> (swaps B:1)
```

The `<template id="B:0">` markers are the fallback placeholders. When a boundary resolves, React streams a `<div hidden id="S:0">` holding the completed HTML plus a script that swaps it into the page. The timestamps show each boundary resolving independently.

> **Good to know:** `Accept-Encoding: identity` disables compression, so chunks are not buffered by the compression layer.

**Compare a bot request.** Adding `'User-Agent': 'Twitterbot/1.0'` to the same script makes `await fetch()` itself block until the full render completes, and the body then arrives in one burst with none of the staggered timestamps — the [bots and crawlers](#bots-and-crawlers) behavior in action.

### Platform support

| Deployment option | Streaming supported |
| --- | --- |
| Node.js server | Yes |
| Docker container | Yes |
| Static export | No |
| Adapters | Platform-specific |

## Infrastructure implications

The component-level rendering model has direct consequences for whatever hosts the app:

* **Streaming** is required, because static and dynamic content are served in a single response.
* **Cache coordination** is required across multiple instances, because any cached content can be invalidated on demand with `revalidateTag()` or `revalidatePath()`.
* **Cache consistency** matters, because revalidation regenerates both the HTML and the RSC payload. If they drift apart, users can see inconsistent data during navigation.
* **PPR shell delivery at CDN latency** can require extra platform integration to store the static shell separately and resume dynamic rendering correctly.

The docs distinguish two levels of platform support. **Functional fidelity** means every feature works correctly — it is binary, and the [adapter test suite](/docs/app/api-reference/adapters/testing-adapters) is the contract. **Performance fidelity** means features reach their optimal characteristics (PPR's shell served at CDN latency rather than origin latency, ISR propagating in under a second) — this is a spectrum, and it is how platforms differentiate. A platform with functional fidelity is a fully supported deployment target.

## Summary

The trigger for dynamic rendering is **the code itself**: async work, non-deterministic output, or runtime data. When the framework meets those, it walks up the tree looking for a `<Suspense>` boundary to use as a fallback. Everything above those boundaries forms the static shell, which is sent immediately; as each boundary resolves, React streams the result into the page.

So the two decisions that shape rendering are **what to cache** and **where to place the boundaries**. Cache what can be cached with `use cache` to grow the static shell, push dynamic access down to the components that actually need it, and wrap those in `<Suspense>`. Everything else becomes shell.

## Further reading

* [Rendering Philosophy](/docs/app/guides/rendering-philosophy) — the static/dynamic spectrum and its trade-offs
* [Streaming](/docs/app/guides/streaming) — the full guide this note condenses
* [Caching](/docs/app/getting-started/caching) — `use cache`, `cacheLife`, prerendering and prefetching
* [Glossary](/docs/app/glossary) — prerendering, dynamic rendering, static shell, App Shell, PPR, hydration, RSC payload
* [RSC Explorer](https://rscexplorer.dev/) — interactive tool for exploring the component payload format
* [Chunked transfer encoding (MDN)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Transfer-Encoding) — the HTTP/1.1 mechanism behind streaming
* [Preventing flash before hydration](/docs/app/guides/preventing-flash-before-hydration) — updating server-rendered HTML with client-specific values before paint
