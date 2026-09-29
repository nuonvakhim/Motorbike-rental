# Deployment

A Next.js app is a Node.js server. Everything else — containers, static hosts, platform adapters — is a variation on that one fact, and the docs are unusually blunt about it: to run Next.js, your platform needs a Node.js server, *that's it*. A single `next start` process handles Server Components, ISR, PPR, Cache Components, Server Actions, Proxy and `after()` correctly. Extra infrastructure buys performance and multi-instance consistency, not correctness.

This note covers choosing a target, what a platform has to support, and the configuration that self-hosting needs. Containers, image builds and CI pipelines are in [NextJs_Docker_CI_CD.md](NextJs_Docker_CI_CD.md); the security side of going live is in [NextJs_Security.md](NextJs_Security.md).

## Four targets

| Option | Feature support |
| --- | --- |
| **Node.js server** | All |
| **Docker container** | All |
| **Static export** | Limited |
| **Adapters** | Varies — [verified](#verified-adapters) adapters run the test suite |

### Node.js server

Any provider that runs Node.js will do. All you need is the two scripts:

```json filename="package.json"
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  }
}
```

`npm run build` produces the build, `npm run start` serves it. This supports every Next.js feature. If you need to own the HTTP server itself, you can eject to a [custom server](/docs/app/guides/custom-server), but you lose optimizations in the process — it is a last resort, not a starting point.

### Static export

Setting `output: 'export'` produces plain HTML, CSS and JS that any web server can serve — S3, Nginx, Apache, GitHub Pages. This is the "start as a static site, upgrade to a server later" path, and it also underlies the [SPA](/docs/app/guides/single-page-applications) approach.

The cost is everything that needs a request. Not supported in an export:

- Dynamic Routes with `dynamicParams: true`, or without `generateStaticParams()`
- Route Handlers that rely on `Request`
- `cookies`
- `rewrites`, `redirects` and `headers` from `next.config.js`
- Proxy
- Incremental Static Regeneration
- Image Optimization with the default `loader`
- Draft Mode
- Server Actions
- Intercepting Routes

Using any of them under `next dev` errors out, the same way `export const dynamic = 'error'` in the root layout would. Image Optimization *is* still possible with a custom loader, but images are optimized at runtime by that service, not during the build.

### Adapters and platforms

The [Deployment Adapter API](/docs/app/api-reference/config/next-config-js/adapterPath) lets a platform customize how a Next.js app is built and deployed. Adapters run at build time and turn the standard build into platform-specific output. The API is public — anyone can write one, with no special access.

#### Verified adapters

"Verified" means two specific things: the adapter is **open source**, and the platform provides a way to run the full [compatibility test suite](/docs/app/api-reference/adapters/testing-adapters) against it. Verified adapters live under the [Next.js GitHub organization](https://github.com/nextjs), and the Next.js team coordinates testing with those platform teams before major releases.

Currently verified: **Vercel** and **Bun**. Cloudflare and Netlify are building verified adapters on the same API; in the meantime they ship their own integrations.

Other platforms — Appwrite Sites, AWS Amplify Hosting, Cloudflare, Deno Deploy, Firebase App Hosting, Netlify — offer their own Next.js integrations that are *not* built on the public Adapter API and are not verified, so feature support varies. Check the provider's own docs.

> **Good to know:** a platform can build a closed-source adapter on the same public API and test suite. It just won't be listed as verified, since the team cannot inspect it.

## What a platform actually needs

It helps to separate two ideas the docs name explicitly:

**Functional fidelity** — every feature works correctly. This is binary: the adapter test suite passes or it doesn't. A platform with functional fidelity is a fully supported deployment target.

**Performance fidelity** — features reach their *optimal* characteristics: PPR's static shell served at CDN latency instead of origin latency, ISR propagating revalidation in under a second. This is a spectrum, and it is where platforms differentiate.

### Feature support matrix

"Edge Stitching" below is a performance optimization, **not** a correctness requirement — every feature works correctly from a single origin server.

| Feature | Streaming | Shared Cache | Edge Stitching | Notes |
| --- | --- | --- | --- | --- |
| Server Components | Required | No | No | Basic streaming support |
| ISR (time-based) | No | Recommended | No | Works per-instance without shared cache |
| ISR (on-demand) | No | Recommended | No | Tag propagation needs shared cache for multi-instance |
| Partial Prerendering | Required | Recommended | Optional | See the PPR Platform Guide |
| Cache Components (`use cache`) | Required | Recommended | No | Shared cache enables cross-instance consistency |
| Proxy / Middleware | No | No | No | Runs at edge or origin |
| Server Actions | Required | No | No | POST requests with streaming response |
| `after()` | No | No | No | Requires graceful shutdown support |

**Streaming required** means chunked transfer encoding or HTTP/2 streaming, and no buffering of the response before it reaches the client. Without it things still work — the response is just assembled and sent whole, which throws away the streaming benefit.

**Shared cache recommended** means multiple instances benefit from a shared backend. Without one, each instance keeps its own cache: correct on each instance, but revalidation events don't propagate between them. Use [`cacheHandler`](/docs/app/api-reference/config/next-config-js/incrementalCacheHandlerPath) for ISR and server response caching, [`cacheHandlers`](/docs/app/api-reference/config/next-config-js/cacheHandlers) for `'use cache'` entries.

The only extra dependency beyond Node.js is `sharp`, needed for Image Optimization.

## Self-hosting configuration

### Put a reverse proxy in front

Don't expose the Next.js server directly to the internet. Something like nginx in front handles malformed requests, slow-connection attacks, payload size limits and rate limiting — so the Next.js process can spend its resources rendering instead of validating requests.

### Image optimization

`next/image` works self-hosted with **zero configuration** under `next start`. If you'd rather a separate service do the work, [configure an image loader](/docs/app/api-reference/components/image#loader).

> **Good to know:** on glibc-based Linux, Image Optimization may need [extra configuration](https://sharp.pixelplumbing.com/install#linux-memory-allocator) to avoid excessive memory usage.

### Proxy

[Proxy](/docs/app/api-reference/file-conventions/proxy) also works self-hosted with zero configuration under `next start`. Since it needs the incoming request, it is not available in a static export.

If you need full Node.js APIs in that layer, consider moving the logic into a layout as a Server Component instead — checking `headers` and calling `redirect` works fine there. Header, cookie and query matching in `next.config.js` `redirects`/`rewrites` covers many other cases.

### Streaming through a proxy

Streaming is supported when self-hosting, but a buffering proxy silently defeats it. For nginx, disable buffering:

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

The whole path has to cooperate, not just nginx:

- **Load balancers** must support chunked transfer encoding or HTTP/2 streaming. Some cloud load balancers — AWS ALB with Lambda integration, for example — buffer by default.
- **Reverse proxies** between the load balancer and Next.js must also pass chunked responses through.
- **PPR requires streaming.** Without it, the static shell and dynamic content arrive together after the full render, which removes PPR's entire TTFB advantage.

See [NextJs_Rendering.md](NextJs_Rendering.md) for what streaming is doing for you.

### Caching and ISR

Cached responses, generated static pages, build output and static assets all live in the **same Next.js server cache**, stored on the local filesystem of each instance by default. For one `next start` instance with a persistent disk, that works automatically and needs no thought.

Next.js sets `Cache-Control` for you, and these defaults matter when a CDN is involved:

| What | Header |
| --- | --- |
| Truly immutable assets (SHA-hashed filenames) | `public, max-age=31536000, immutable` — cannot be overridden |
| ISR pages | `s-maxage: <revalidate>, stale-while-revalidate` |
| Dynamically rendered pages | `private, no-cache, no-store, max-age=0, must-revalidate` |

The dynamic header is what stops user-specific data from being cached, including Draft Mode. For the ISR header to help at all, your CDN must respect these directives and the cache-key variability; if it doesn't, responses either bypass the CDN or serve stale/mismatched variants during client-side navigation.

With a CDN in front, a page that touches dynamic APIs gets `Cache-Control: private` and is marked non-cacheable; a fully prerendered page gets `public` and can be cached. If you don't need a mix, keep the whole route static and let the CDN hold the HTML.

### Custom cache handler

On ephemeral compute, or under Kubernetes where each pod has its own copy of the cache, the local-disk default produces divergent stale content. Point Next.js at a shared store and turn off the in-memory layer:

```jsx filename="next.config.js"
module.exports = {
  cacheHandler: require.resolve('./cache-handler.js'),
  cacheMaxMemorySize: 0, // disable default in-memory caching
}
```

```jsx filename="cache-handler.js"
const cache = new Map()

module.exports = class CacheHandler {
  constructor(options) {
    this.options = options
  }

  async get(key) {
    // This could be stored anywhere, like durable storage
    return cache.get(key)
  }

  async set(key, data, ctx) {
    // This could be stored anywhere, like durable storage
    cache.set(key, {
      value: data,
      lastModified: Date.now(),
      tags: ctx.tags,
    })
  }

  async revalidateTag(tags) {
    // tags is either a string or an array of strings
    tags = [tags].flat()
    // Iterate over all entries in the cache
    for (let [key, value] of cache) {
      // If the value's tags include the specified tag, delete this entry
      if (value.tags.some((tag) => tags.includes(tag))) {
        cache.delete(key)
      }
    }
  }

  // Optional per-request in-memory cache, reset before the next request
  resetRequestCache() {}
}
```

The `Map` above is the shape, not the implementation. For production, back it with durable storage (Redis, S3) and add eviction policies, error handling and distributed tag coordination.

There is a second half to this on multi-instance deployments: `revalidateTag()` only invalidates the instance it ran on. Implement [`refreshTags()`](/docs/app/api-reference/config/next-config-js/cacheHandlers#refreshtags) in the handler — it is called before each request and should sync tag state from shared storage so every instance learns about invalidations promptly.

> **Good to know:** `revalidatePath` is a convenience layer over cache tags — it calls `revalidateTag` with a special default tag for that page.

Cache Components work by default when self-hosting, including under `next start` and in a Docker container. It is not a CDN-only feature. See [NextJs_Caching.md](NextJs_Caching.md).

### Static assets on another domain

To serve JS and CSS from a CDN or separate domain, set [`assetPrefix`](/docs/app/api-reference/config/next-config-js/assetPrefix). Next.js will use it when fetching those files. The trade-off is an extra DNS lookup and TLS handshake.

### Graceful shutdown

[`after()`](/docs/app/api-reference/functions/after) is fully supported under `next start`. On shutdown, send `SIGINT` or `SIGTERM` and **wait**: the server finishes in-flight requests and runs pending `after()` callbacks before exiting. Give the platform a configurable drain period — 10–30 seconds is the recommendation — or background work gets killed mid-flight.

## Build-time vs runtime environment variables

This is the distinction that causes the most deployment surprises.

`NEXT_PUBLIC_` variables are **inlined into the JavaScript bundle during `next build`**. After the build, the app no longer responds to changes in them. Promote one artifact from staging to production and every public variable still holds its staging value. If the browser genuinely needs a runtime value, expose it through your own API instead.

Server-side variables have no such constraint, as long as they are read during dynamic rendering:

```tsx filename="app/page.ts" switcher
import { connection } from 'next/server'

export default async function Component() {
  await connection()
  // cookies, headers, and other Request-time APIs
  // will also opt into dynamic rendering, meaning
  // this env variable is evaluated at runtime
  const value = process.env.MY_VALUE
  // ...
}
```

That is what makes one image promotable through multiple environments. Load order, lowest priority last:

1. `process.env`
2. `.env.$(NODE_ENV).local`
3. `.env.local` — not checked when `NODE_ENV` is `test`
4. `.env.$(NODE_ENV)`
5. `.env`

`NODE_ENV` may only be `production`, `development` or `test`; Next.js assigns `development` for `next dev` and `production` for everything else. With a `/src` directory, `.env.*` files still belong at the project root. Code that must run on server startup goes in the [`register` function](/docs/app/guides/instrumentation).

## Production checklist

Before going live, run `next build` locally to catch build errors, then `next start` to measure in a production-like environment.

**Already handled for you, no configuration:** Server Components keep code out of the client bundle, code-splitting happens per route segment, `<Link>` prefetches routes entering the viewport, Server and Client Components are prerendered at build time where possible, and data requests, rendered output and static assets are cached.

**Worth checking before you ship:**

| Area | What to verify |
| --- | --- |
| Rendering | Request-time APIs (`cookies`, `searchParams`) opt the whole route into dynamic rendering — the whole *app* if used in the root layout. Are they intentional, and wrapped in `<Suspense>`? |
| Errors | A custom `not-found`, plus `app/global-error.tsx` and `app/global-not-found.tsx` for accessible app-wide fallbacks |
| Data | Parallel fetching instead of waterfalls; non-`fetch` requests cached where appropriate; Route Handlers not called from Server Components |
| Assets | Font Module for fonts, `<Image>` for images, `<Script>` for third-party scripts, `public/` for static files |
| Security | `.env*` in `.gitignore`, only public vars prefixed `NEXT_PUBLIC_`, auth re-checked inside every Server Action, a CSP considered — see [NextJs_Security.md](NextJs_Security.md) |
| SEO | Metadata, OG images, sitemap and robots — see [NextJs_SEO.md](NextJs_SEO.md) |
| Types | TypeScript plus the TS plugin |
| Accessibility | The built-in `eslint-plugin-jsx-a11y` |
| Measurement | Lighthouse in incognito, `useReportWebVitals` for field data, `@next/bundle-analyzer` for bundle size — see [NextJs_Performance.md](NextJs_Performance.md) |

## Summary

Deployment decisions collapse into one question: does this app need a request at runtime? If yes, you need a Node.js server, and everything works. If no, `output: 'export'` gives you static files you can put anywhere — at the cost of cookies, Proxy, Server Actions, ISR and the default image loader.

When self-hosting, four things need deliberate configuration and the rest is defaults: a reverse proxy in front, buffering disabled end-to-end so streaming survives, a shared cache handler if more than one instance runs, and a drain period on shutdown so `after()` callbacks finish.

The trap to internalize is `NEXT_PUBLIC_`. Those values are baked into the bundle at build time, so a single artifact cannot carry different ones per environment. Server-side variables read during dynamic rendering stay live — which is exactly what makes build-once-deploy-everywhere possible.

## Further reading

* [Deploying](/docs/app/getting-started/deploying) — the four targets
* [Deploying to Platforms](/docs/app/guides/deploying-to-platforms) — the feature/infrastructure matrix
* [Self-Hosting](/docs/app/guides/self-hosting) — the guide most of this note condenses
* [Production Checklist](/docs/app/guides/production-checklist)
* [Static Exports](/docs/app/guides/static-exports)
* [Environment Variables](/docs/app/guides/environment-variables)
* [CDN Caching](/docs/app/guides/cdn-caching)
* [PPR Platform Guide](/docs/app/guides/ppr-platform-guide)
* [Self-hosting Next.js](https://www.youtube.com/watch?v=sIVL4JMqRfc) — 45-minute walkthrough from the Next.js team
