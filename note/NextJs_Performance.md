# Performance

Performance work in the App Router splits into two halves. The first is **what the framework already does** — Server Components, code splitting, prefetching, prerendering and caching are on by default and need no configuration. The second is **what only you can do**: how images, fonts and third-party scripts enter the page, how much JavaScript reaches the browser, and how you measure the result.

This note covers the second half. The rendering side of performance — streaming, Suspense boundaries, the static shell and how they move each Web Vital — is in [NextJs_Rendering.md](NextJs_Rendering.md); caching and prefetching are in [NextJs_Caching.md](NextJs_Caching.md). Those are not repeated here.

## What you get for free

| Optimization | What it does |
| --- | --- |
| **Server Components** | The default. They run on the server and contribute **nothing** to the client bundle. |
| **Code splitting** | Automatic, per route segment. Only the code for the current route is loaded. |
| **Prefetching** | When a `<Link>` enters the viewport, the route is fetched in the background. |
| **Prerendering** | Server and Client Components are rendered at build time where possible and the result is cached. |
| **Caching** | Data requests, rendered output and static assets are cached to cut network round trips. |

Everything below is about the cases these defaults don't cover.

## Images

`next/image` extends `<img>` with four things: **size optimization** (correctly sized images in modern formats), **visual stability** (space is reserved so nothing shifts), **lazy loading** (native, with optional blur-up placeholders), and **on-demand resizing** — including for images on remote servers.

```tsx filename="app/page.tsx"
import Image from 'next/image'

export default function Page() {
  return <Image src="/profile.png" alt="Picture of the author" width={500} height={500} />
}
```

### Three kinds of `src`

**Static import** — the best case. Next.js reads the file at build time and fills in `width`, `height` and `blurDataURL` for you:

```tsx
import ProfileImage from './profile.png'

<Image
  src={ProfileImage}
  alt="Picture of the author"
  // width, height and blurDataURL are provided automatically
  placeholder="blur" // optional blur-up while loading
/>
```

**Path string** — a file under `public/`, referenced from the base URL (`/profile.png`). You must pass `width` and `height` yourself.

**Remote URL** — you must pass `width` and `height` (and `blurDataURL` if you want a blur placeholder), because Next.js has no access to the file at build time. You must also allow the host in `next.config.ts`, and be as specific as possible:

```ts filename="next.config.ts"
import type { NextConfig } from 'next'

const config: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 's3.amazonaws.com',
        port: '',
        pathname: '/my-bucket/**',
        search: '',
      },
    ],
  },
}

export default config
```

This is a security boundary, not a convenience: a loose pattern turns your image optimizer into an open proxy for arbitrary remote images.

### Images you cannot statically import

If the filename is only known at runtime, a **dynamic `import()`** in a Server Component still gets you the automatic dimensions and blur data:

```tsx filename="app/blog/[slug]/page.tsx"
async function PostImage({ imageFilename, alt }: { imageFilename: string; alt: string }) {
  const { default: image } = await import(`../content/blog/images/${imageFilename}`)
  // image contains width, height, and blurDataURL
  return <Image src={image} alt={alt} />
}
```

The path must include a **static prefix** (`../content/blog/images/`). Everything matching that prefix is bundled, so keep it narrow. Because the prefix is fixed, external input cannot escape the directory.

### Props worth knowing

| Prop | Default | Notes |
| --- | --- | --- |
| `alt` | — | Required. Use `alt=""` for purely decorative images. |
| `width` / `height` | — | Intrinsic size in px, used to reserve the aspect ratio. Required unless the image is statically imported or uses `fill`. They do **not** set the rendered size — CSS does. |
| `fill` | `false` | The image expands to fill its parent. Use when the dimensions are unknown. |
| `sizes` | — | See below. |
| `quality` | `75` | 1–100. Higher is larger and sharper. |
| `preload` | `false` | Injects `<link rel="preload">` in `<head>`. For the LCP image only. |
| `loading` | `lazy` | `eager` loads immediately regardless of position. |
| `placeholder` | `empty` | `blur` (needs `blurDataURL`) or a `data:image/...` URL. |
| `unoptimized` | `false` | Skips optimization. Needed when the source requires auth headers, which the optimizer does not forward. |

> **Deprecation:** as of Next.js 16, `priority` is deprecated in favour of [`preload`](/docs/app/api-reference/components/image#preload), which names what it actually does.

### `sizes` and why a missing one is expensive

`sizes` tells the browser how wide the image will be at each breakpoint, so it can pick the right entry from `srcset`.

```tsx
<Image fill src="/example.png" sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" />
```

Use it whenever the image uses `fill` or is made responsive with CSS. **If `sizes` is missing, the browser assumes the image is as wide as the viewport (`100vw`)** and downloads a far larger file than it needs.

`sizes` also changes what Next.js generates:

* **Without `sizes`** — a limited `srcset` (1x, 2x), right for fixed-size images.
* **With `sizes`** — a full `srcset` (640w, 750w, …), right for responsive layouts.

### Preloading the LCP image

`preload` starts the fetch from the `<head>`, before the browser discovers the `<img>` tag in the body. Use it when the image **is** the [Largest Contentful Paint](https://web.dev/lcp/) element — typically a hero image above the fold.

Do not use it when several images could be the LCP element depending on viewport, or alongside `loading` / `fetchPriority`. In most other cases `loading="eager"` or `fetchPriority="high"` is the better tool.

### Output format

```js filename="next.config.js"
module.exports = {
  images: {
    formats: ['image/webp'], // default
  },
}
```

Next.js reads the request's `Accept` header and picks the first configured format the browser supports; **array order matters**. AVIF compresses about 20% smaller than WebP but takes roughly 50% longer to encode, so the first request for an image is slower and each format is cached separately. WebP remains the recommendation for most sites.

> If you self-host behind a CDN or proxy, it **must** forward the `Accept` header or format negotiation breaks.

`minimumCacheTTL` (default 4 hours) sets how long optimized images are cached. There is no cache invalidation mechanism, so keep it low unless you are prepared to change the `src` or delete `<distDir>/cache/images` by hand. Static imports sidestep this entirely: their filenames are content-hashed and cached as `immutable`.

## Fonts

`next/font` **self-hosts every font file**, including Google Fonts. The files are served from your own domain, so the browser never contacts Google, and the font is preloaded with a matched fallback so there is no layout shift.

This project already uses the CSS-variable form in [app/layout.tsx](app/layout.tsx):

```tsx filename="app/layout.tsx"
import { Geist, Geist_Mono } from 'next/font/google'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  )
}
```

The simpler form applies the font directly with `className={geist.className}`. The `variable` form declares a CSS custom property instead, which is what you want when a stylesheet or Tailwind config needs to reference the family.

**Prefer variable fonts.** If the font is not variable, `weight` becomes required:

```tsx
const roboto = Roboto({ weight: '400', subsets: ['latin'] })
```

### Local fonts

```tsx
import localFont from 'next/font/local'

const myFont = localFont({ src: './my-font.woff2' })
```

The path resolves relative to the file calling `localFont`. For several files in one family, pass an array:

```js
const roboto = localFont({
  src: [
    { path: './Roboto-Regular.woff2', weight: '400', style: 'normal' },
    { path: './Roboto-Italic.woff2', weight: '400', style: 'italic' },
    { path: './Roboto-Bold.woff2', weight: '700', style: 'normal' },
  ],
})
```

### Options

| Option | Default | Applies to | Notes |
| --- | --- | --- | --- |
| `subsets` | — | google | Which subsets to preload, e.g. `['latin']`. Preload tags are only injected for these. |
| `weight` | — | both | Required for non-variable fonts. A range (`'100 900'`) for variable ones. |
| `display` | `'swap'` | both | Standard `font-display` values. |
| `preload` | `true` | both | Injects `<link rel="preload">`. |
| `fallback` | — | both | e.g. `['system-ui', 'arial']`. |
| `adjustFontFallback` | `true` / `'Arial'` | both | Generates a metric-matched fallback font to cut CLS. `false` disables it. |
| `variable` | — | both | The CSS variable name to declare. |
| `axes` | — | google | Extra variable axes beyond weight. Each one costs file size. |

### Where a font is preloaded

A font is **not** global just because it is imported somewhere. It is preloaded only on the routes that use it:

* Called in a **page** → preloaded on that route.
* Called in a **layout** → preloaded on every route the layout wraps.
* Called in the **root layout** → preloaded on every route.

## Third-party scripts

`next/script` defers third-party scripts so they do not block the main thread, and guarantees a script **loads only once** even as the user navigates between routes sharing the layout that declares it.

```tsx filename="app/dashboard/layout.tsx"
import Script from 'next/script'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <section>{children}</section>
      <Script src="https://example.com/script.js" />
    </>
  )
}
```

Put the script in the narrowest layout that needs it. A script in the root layout runs on every route in the application.

### Strategies

| `strategy` | When it loads | Use for |
| --- | --- | --- |
| `beforeInteractive` | Injected into the server HTML, fetched before any Next.js code. Must live in the **root layout**. | Only genuinely critical scripts — bot detection, consent management. |
| `afterInteractive` | **Default.** Client-side, after some hydration. | Tag managers, analytics. |
| `lazyOnload` | During browser idle time, after everything else has loaded. | Chat widgets, social embeds. |
| `worker` | In a web worker via Partytown. **Experimental, does not work with the App Router.** | — |

`beforeInteractive` is preloaded ahead of first-party code but its execution still does not block hydration.

### Inline scripts and handlers

Inline scripts **must** have an `id` so Next.js can track and optimize them:

```jsx
<Script id="show-banner">
  {`document.getElementById('banner').classList.remove('hidden')`}
</Script>
```

`onLoad`, `onReady` and `onError` only work inside a Client Component. Any other DOM attribute you pass (`nonce`, `data-*`) is forwarded to the final `<script>` tag.

> For **JSON-LD**, use a plain `<script type="application/ld+json">`, not `next/script` — structured data is not executable code. See [NextJs_SEO.md](NextJs_SEO.md).

## Lazy loading client JavaScript

Server Components are already code-split, and streaming already delivers UI progressively. **Lazy loading is about Client Components and the libraries they import** — deferring them so they are not in the initial bundle.

`next/dynamic` is `React.lazy()` plus Suspense in one call:

```jsx filename="app/page.js"
'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'

const ComponentA = dynamic(() => import('../components/A'))
const ComponentB = dynamic(() => import('../components/B'))
const ComponentC = dynamic(() => import('../components/C'), { ssr: false })

export default function Example() {
  const [showMore, setShowMore] = useState(false)

  return (
    <div>
      {/* Loads immediately, but in its own client bundle */}
      <ComponentA />

      {/* Loads on demand, only if the condition is met */}
      {showMore && <ComponentB />}
      <button onClick={() => setShowMore(!showMore)}>Toggle</button>

      {/* Client-side only */}
      <ComponentC />
    </div>
  )
}
```

Add a fallback with `loading`:

```jsx
const WithCustomLoading = dynamic(() => import('../components/WithCustomLoading'), {
  loading: () => <p>Loading...</p>,
})
```

Named exports come off the promise:

```jsx
const ClientComponent = dynamic(() => import('../components/hello').then((mod) => mod.Hello))
```

**Constraints worth remembering:**

* `ssr: false` works **only in Client Components**. Using it in a Server Component is an error.
* When a *Server* Component dynamically imports a *Client* Component, automatic code splitting is currently **not** supported.
* Dynamically importing a Server Component lazy-loads its Client Component children, not the Server Component itself.

### Libraries on demand

A heavy library used by one interaction does not need to be in the bundle at all:

```jsx
onChange={async (e) => {
  const { value } = e.currentTarget
  const Fuse = (await import('fuse.js')).default
  setResults(new Fuse(names).search(value))
}}
```

### Magic comments

These work with dynamic `import()`, `require()`, `require.resolve()` and `new Worker()` — **not** with static `import` statements.

```js
// Leave the import in the output; resolve it at runtime
const runtime = await import(/* webpackIgnore: true */ 'runtime-module')
const plugin = await import(/* turbopackIgnore: true */ pluginPath)

// Turbopack only: no build error if the module does not exist
const feature = await import(/* turbopackOptional: true */ './optional-feature')
```

`webpackOptional` does not exist; use `turbopackOptional` under Turbopack.

## Finding and fixing large bundles

Smaller bundles load faster, run less JavaScript, improve Core Web Vitals and shorten server cold starts.

### Measuring

**Turbopack analyzer** (v16.1+, experimental) — integrated with the module graph, so you can trace a module's full import chain and see exactly who pulled it in:

```bash
npx next experimental-analyze
npx next experimental-analyze --output   # writes .next/diagnostics/analyze for diffing
```

**Webpack analyzer** — `@next/bundle-analyzer`:

```js filename="next.config.js"
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

module.exports = withBundleAnalyzer({})
```

```bash
ANALYZE=true npm run build
```

### Packages with hundreds of exports

Icon and utility libraries can export thousands of modules. `optimizePackageImports` loads only the ones you actually use:

```js filename="next.config.js"
module.exports = {
  experimental: {
    optimizePackageImports: ['icon-library'],
  },
}
```

Many common packages are already optimized by default — `lucide-react`, `date-fns`, `lodash-es`, `ramda`, `antd`, `@mui/material`, `@mui/icons-material`, `recharts`, `rxjs`, `@headlessui/react`, `@heroicons/react/*`, `@tabler/icons-react`, `react-icons/*`, `effect` and others — so they need no entry.

### Heavy work in the wrong place

The most common cause of a large client bundle is doing work in a Client Component that produces nothing but markup: syntax highlighting, chart rendering, markdown parsing. If it needs no browser API and no interaction, it belongs on the server.

```tsx filename="app/blog/[slug]/page.tsx"
// The whole prism tokenizer ships to the browser to render a <code> block
'use client'
import Highlight from 'prism-react-renderer'
```

```tsx filename="app/blog/[slug]/page.tsx"
// Better: shiki runs on the server; the client receives plain markup
import { codeToHtml } from 'shiki'

export default async function Page() {
  const highlightedHtml = await codeToHtml(code, { lang: 'tsx', theme: 'github-dark' })
  return <pre><code dangerouslySetInnerHTML={{ __html: highlightedHtml }} /></pre>
}
```

### Server bundling

Packages imported in Server Components and Route Handlers are bundled automatically. Opt a package out when it does not survive bundling — native addons, or packages that read files relative to themselves:

```js filename="next.config.js"
module.exports = {
  serverExternalPackages: ['package-name'],
}
```

### Before you add a dependency

[Import Cost](https://marketplace.visualstudio.com/items?itemName=wix.vscode-import-cost) · [Package Phobia](https://packagephobia.com/) · [Bundle Phobia](https://bundlephobia.com/) · [bundlejs](https://bundlejs.com/)

## Measuring the result

### Web Vitals

| Metric | What it measures |
| --- | --- |
| **TTFB** | Time to first byte. |
| **FCP** | First contentful paint. |
| **LCP** | Largest contentful paint — the main content. |
| **CLS** | Cumulative layout shift — visual stability. |
| **INP** | Interaction to next paint — responsiveness. |
| **FID** | First input delay (superseded by INP). |

How streaming and Suspense placement move each of these is covered in [NextJs_Rendering.md](NextJs_Rendering.md), under "Rendering and Web Vitals".

### Reporting them yourself

`useReportWebVitals` needs `'use client'`, so put it in its own component and import that from the root layout. That keeps the client boundary confined to a component that renders nothing:

```jsx filename="app/_components/web-vitals.js"
'use client'

import { useReportWebVitals } from 'next/web-vitals'

export function WebVitals() {
  useReportWebVitals((metric) => {
    console.log(metric)
  })
}
```

```jsx filename="app/layout.js"
import { WebVitals } from './_components/web-vitals'

export default function Layout({ children }) {
  return (
    <html>
      <body>
        <WebVitals />
        {children}
      </body>
    </html>
  )
}
```

Send the results anywhere, preferring `sendBeacon` so the request survives page unload:

```js
useReportWebVitals((metric) => {
  const body = JSON.stringify(metric)
  const url = 'https://example.com/analytics'

  if (navigator.sendBeacon) {
    navigator.sendBeacon(url, body)
  } else {
    fetch(url, { body, method: 'POST', keepalive: true })
  }
})
```

`metric.id` is unique per page load, which is what lets you rebuild percentile distributions from raw events.

### Client instrumentation

An `instrumentation-client.ts` file at the project root runs **before** any frontend code — the right place to initialize analytics or error tracking:

```js filename="instrumentation-client.js"
console.log('Analytics initialized')

window.addEventListener('error', (event) => {
  reportError(event.error)
})
```

### Lab vs field

Run [Lighthouse](https://developers.google.com/web/tools/lighthouse) in incognito for a repeatable lab measurement, but treat it as a simulation. Pair it with field data from real users, which is what `useReportWebVitals` gives you. Before measuring anything, run `next build` and `next start` — `next dev` is not representative.

## Production checklist

Condensed from the [production checklist](/docs/app/guides/production-checklist); the items already covered by other notes are linked rather than repeated.

* **Check your `"use client"` boundaries.** Every one is a bundle. Push them down to the leaves that need interactivity.
* **Request-time APIs are a rendering decision.** `cookies()`, `headers()` and `searchParams` opt a route into dynamic rendering — the whole app if used in the root layout. Wrap them in `<Suspense>`. See [NextJs_Rendering.md](NextJs_Rendering.md).
* **Fetch in parallel** to avoid waterfalls, and verify what is actually cached. See [NextJs_Fetching_Data.md](NextJs_Fetching_Data.md) and [NextJs_Caching.md](NextJs_Caching.md).
* **Do not call Route Handlers from Server Components** — it adds a pointless network hop.
* **Use `<Link>`** for navigation so prefetching works.
* **Use `next/image`, `next/font` and `next/script`** rather than raw tags.
* **Serve static assets from `public/`** so they are cached automatically.
* **Keep `eslint-plugin-jsx-a11y` on** to catch accessibility problems early.
* **Add `error.tsx` and `not-found.tsx`** so failures degrade gracefully instead of blanking the page.

## Summary

The framework handles the structural optimizations — splitting code, prefetching routes, prerendering what it can, caching the rest. What is left to you is everything that crosses the boundary into the browser.

Three questions cover most of it. **What is the LCP element, and is it discovered early?** That is `preload` on the hero image, fonts preloaded from the right layout, and keeping that element out of a Suspense boundary. **What is shipping to the client that does not need to?** That is the bundle analyzer, `optimizePackageImports`, and moving render-only libraries to the server. **What is blocking the main thread?** That is `next/script` strategies and lazy-loading interactive components.

Then measure with real users, not just Lighthouse.

## Further reading

* [Image Optimization](/docs/app/getting-started/images) and the [`<Image>` API reference](/docs/app/api-reference/components/image)
* [Font Optimization](/docs/app/getting-started/fonts) and the [`next/font` API reference](/docs/app/api-reference/components/font)
* [Scripts](/docs/app/guides/scripts) and the [`<Script>` API reference](/docs/app/api-reference/components/script)
* [Lazy Loading](/docs/app/guides/lazy-loading)
* [Package Bundling](/docs/app/guides/package-bundling) and [`optimizePackageImports`](/docs/app/api-reference/config/next-config-js/optimizePackageImports)
* [Analytics](/docs/app/guides/analytics) and [`useReportWebVitals`](/docs/app/api-reference/functions/use-report-web-vitals)
* [Production Checklist](/docs/app/guides/production-checklist)
* [Web Vitals](https://web.dev/articles/vitals) (web.dev)
