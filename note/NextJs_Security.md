# Security

Server Components moved data access into the same files that render UI. That is the whole point — no API round trip to read your own database — but it also erased a boundary that used to be obvious. In the Pages Router the network request *was* the security boundary: anything the browser got, it asked for. In the App Router the boundary is a module graph, and it is invisible unless you keep it visible on purpose.

This note is about keeping it visible. It covers where data is allowed to be read, what is allowed to cross to the client, how Server Actions are actually reachable, and the headers that sit in front of all of it. Authentication itself — sessions, cookies, login flows — is in [NextJs_Authentication.md](NextJs_Authentication.md) and not repeated here.

## Pick one data-fetching shape

There are three shapes, and the docs are explicit that you should pick **one** and not mix them, so that both the next developer and any auditor know what to expect.

| Shape | Use it for | The risk it carries |
| --- | --- | --- |
| **External HTTP APIs** | Existing large apps, separate backend teams | None new — you keep the boundary you already had |
| **Data Access Layer (DAL)** | New projects | Requires discipline to set up, then enforces itself |
| **Component-level access** | Prototypes and learning | Easiest to leak private fields to the client |

### External HTTP APIs

If you already have REST or GraphQL endpoints with auth in front of them, keep calling them. Server Components can `fetch` exactly like Client Components could, forwarding the session cookie:

```tsx filename="app/page.tsx"
import { cookies } from 'next/headers'

export default async function Page() {
  const cookieStore = await cookies()
  const token = cookieStore.get('AUTH_TOKEN')?.value

  const res = await fetch('https://api.example.com/profile', {
    headers: {
      Cookie: `AUTH_TOKEN=${token}`,
    },
  })

  // ...
}
```

This is the **Zero Trust** option: the server rendering your UI gets no more privilege than the browser did. It is the right default when adopting Server Components in an existing system.

### Data Access Layer

For a new project, build a DAL: an internal module that is the only thing in the codebase allowed to touch the database. It has three jobs — run **only** on the server, perform the **authorization** check, and return a minimal **Data Transfer Object (DTO)** rather than a database row.

```ts filename="data/auth.ts"
import { cache } from 'react'
import { cookies } from 'next/headers'

// Cached helpers make it easy to read the same value in many places without
// passing it from Server Component to Server Component — which is what
// eventually leaks it into a Client Component.
export const getCurrentUser = cache(async () => {
  const cookieStore = await cookies()
  const token = cookieStore.get('AUTH_TOKEN')
  const decodedToken = await decryptAndValidate(token)
  // Don't put secret tokens or private information on public fields.
  // Use a class so the whole object can't be handed to the client by accident.
  return new User(decodedToken.id)
})
```

The DTO layer is where the privacy rules live. Note that it re-reads the current user from the cache rather than accepting it as an argument — one less thing a caller can get wrong:

```tsx filename="data/user-dto.tsx"
import 'server-only'
import { getCurrentUser } from './auth'

function canSeeUsername(viewer: User) {
  // Public for now, but this can change
  return true
}

function canSeePhoneNumber(viewer: User, team: string) {
  // Privacy rules
  return viewer.isAdmin || team === viewer.team
}

export async function getProfileDTO(slug: string) {
  // Use a database API that supports safe templating of queries
  const [rows] = await sql`SELECT * FROM user WHERE slug = ${slug}`
  const userData = rows[0]

  const currentUser = await getCurrentUser()

  // Return only the data relevant to this query, not everything
  return {
    username: canSeeUsername(currentUser) ? userData.username : null,
    phonenumber: canSeePhoneNumber(currentUser, userData.team)
      ? userData.phonenumber
      : null,
  }
}
```

The page then handles an object it knows is safe to pass anywhere:

```tsx filename="app/page.tsx"
import { getProfileDTO } from '../../data/user-dto'

export default async function Page({ params }) {
  const { slug } = await params
  const profile = await getProfileDTO(slug)
  // ...
}
```

> **Good to know:** secrets belong in environment variables, and **only the Data Access Layer should read `process.env`**. That single rule is what makes "are secrets used outside the DAL?" a grep-able audit question.

### Component-level access

Querying straight from a Server Component is fine for a prototype. The failure mode is one line long:

```tsx filename="app/page.tsx"
import Profile from './components/profile.tsx'

export default async function Page({ params }) {
  const { slug } = await params
  const [rows] = await sql`SELECT * FROM user WHERE slug = ${slug}`
  const userData = rows[0]
  // EXPOSED: every column of `userData` is now serialized to the client,
  // because it is passed from a Server Component to a Client Component.
  return <Profile user={userData} />
}
```

The Client Component's prop type is complicit here — `user: User` invites the server to hand over the whole record. Narrow the prop, and sanitize before the boundary:

```ts filename="data/user.ts"
import { sql } from './db'

export async function getUser(slug: string) {
  const [rows] = await sql`SELECT * FROM user WHERE slug = ${slug}`
  const user = rows[0]

  // Return only the public fields
  return {
    name: user.name,
  }
}
```

## What actually crosses the boundary

On the initial load both Server and Client Components run on the server to produce HTML — but in **isolated module systems**. That isolation is the mechanism behind the rule:

- **Server Components** run only on the server, and may read environment variables, secrets, databases and internal APIs.
- **Client Components** run on the server during prerendering, but must be written under the same assumptions as browser code. They must never reach for privileged data or server-only modules.

So the app is secure by default. What is *not* automatic is the data you choose to pass across — props are serialized, and serialized means public. Functions and classes are blocked from crossing already; plain objects are not. See [NextJs_Server_and_Client_Components.md](NextJs_Server_and_Client_Components.md) for the boundary itself.

### Tainting

React's Taint APIs are a second net under the first. Enable them in `next.config.js`:

```js filename="next.config.js"
module.exports = {
  experimental: {
    taint: true,
  },
}
```

Then `experimental_taintObjectReference` marks an object, and `experimental_taintUniqueValue` marks a specific value, as never-to-be-sent. Passing a tainted thing to the client becomes an error instead of a breach. Treat it as defence in depth — it does not replace filtering in the DAL.

### `server-only`

To make the isolation a **build error** rather than a runtime surprise, mark server modules:

```ts filename="lib/data.ts"
import 'server-only'

//...
```

Now importing that module from a Client Component fails the build. Next.js handles these imports internally and does not use the npm package's contents, but you can install it if your lint rules complain about extraneous dependencies:

```bash package="npm"
npm install server-only
```

## Server Actions are public endpoints

This is the single most misunderstood part of the model. **An exported Server Action is reachable by a direct POST request**, whether or not any of your UI calls it. It is an endpoint.

Next.js does two things to limit the blast radius:

- **Secure action IDs** — encrypted, non-deterministic IDs the client uses to reference an action. They are recalculated between builds (cached for at most 14 days, regenerated on a new build or when the build cache is invalidated).
- **Dead code elimination** — actions that nothing references are removed from the bundle at `next build`, so no public endpoint is created for them.

```jsx
// app/actions.js
'use server'

// Used in the app → Next.js mints a secure ID so the client can call it.
export async function updateUserAction(formData) {}

// Not used anywhere → removed during `next build`, no public endpoint.
export async function deleteUserAction(formData) {}
```

Neither of these is an authorization check. They reduce the damage when an auth layer is missing; they are not the auth layer.

### Validate every client input

Form data, URL params, headers and `searchParams` are all attacker-controlled. The difference between the two halves of this example is the whole lesson:

```tsx filename="app/page.tsx"
// BAD: trusting searchParams directly
export default async function Page({ searchParams }) {
  const isAdmin = (await searchParams).isAdmin
  if (isAdmin === 'true') {
    // Vulnerable: relies on untrusted client data
    return <AdminPanel />
  }
}

// GOOD: re-verify every time
import { cookies } from 'next/headers'
import { verifyAdmin } from './auth'

export default async function Page() {
  const cookieStore = await cookies()
  const token = cookieStore.get('AUTH_TOKEN')
  const isAdmin = await verifyAdmin(token)

  if (isAdmin) {
    return <AdminPanel />
  }
}
```

### A page check does not protect its actions

A page-level `redirect` controls **which UI renders**. The Server Action defined inside that page is a separate entry point with its own request, and it must verify the caller itself:

```tsx filename="app/admin/page.tsx" highlight={13,14,15,16}
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function AdminPage() {
  const session = await auth()
  if (!session?.user?.isAdmin) {
    redirect('/login')
  }

  return (
    <form
      action={async () => {
        'use server'
        const session = await auth()
        if (!session?.user?.isAdmin) {
          throw new Error('Unauthorized')
        }
        await db.record.deleteMany()
      }}
    >
      <button>Delete Records</button>
    </form>
  )
}
```

### Authentication is not authorization

"Is this user logged in?" and "may this user act on *this* record?" are different questions. Skipping the second gives you an [Insecure Direct Object Reference (IDOR)](https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html) — a logged-in user deleting someone else's post by changing an ID:

```tsx filename="app/actions.ts"
'use server'

import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

export async function deletePost(postId: string) {
  const session = await auth()
  if (!session?.user) {
    throw new Error('Unauthorized')
  }

  const post = await db.post.findUnique({ where: { id: postId } })

  // Check that the user owns this resource
  if (post.authorId !== session.user.id) {
    throw new Error('Forbidden')
  }

  await db.post.delete({ where: { id: postId } })
}
```

The same DAL pattern applies to mutations: put auth, authz and database access in a `server-only` module and keep the `'use server'` file thin.

```ts filename="app/actions.ts"
'use server'

import { deletePost } from '@/data/posts'
import { revalidatePath } from 'next/cache'

export async function deletePostAction(postId: string) {
  await deletePost(postId) // Auth + authz happen inside the DAL
  revalidatePath('/posts')
}
```

> **Good to know:** `import 'server-only'` works in both the DAL and the `"use server"` file itself, even when the action is imported into a Client Component for `useActionState`, because `"use server"` modules are resolved in a server-only bundler layer.

### Return values are serialized too

Whatever an action returns goes over the wire. Returning the result of an ORM call sends every column, including the ones you forgot about:

```tsx filename="app/actions.ts"
'use server'

// BAD: returns the full database record, internal fields included.
export async function updateUser(data: FormData) {
  const session = await auth()
  if (!session?.user) {
    throw new Error('Unauthorized')
  }
  return db.user.update({
    where: { id: session.user.id },
    data: { name: data.get('name') as string },
  })
}

// GOOD: returns only what the client needs.
export async function updateUserSafe(data: FormData) {
  const session = await auth()
  if (!session?.user) {
    throw new Error('Unauthorized')
  }
  await db.user.update({
    where: { id: session.user.id },
    data: { name: data.get('name') as string },
  })
  return { success: true }
}
```

Expensive actions — sending mail, writing rows — should also be rate limited.

### Closures are sent to the client and back

Defining an action inside a component closes over that component's scope, which is genuinely useful for capturing a snapshot at render time:

```tsx filename="app/page.tsx" switcher
export default async function Page() {
  const publishVersion = await getLatestVersion();

  async function publish() {
    "use server";
    if (publishVersion !== await getLatestVersion()) {
      throw new Error('The version has changed since pressing publish');
    }
    ...
  }

  return (
    <form>
      <button formAction={publish}>Publish</button>
    </form>
  );
}
```

For that snapshot to survive until the action fires, the captured variables travel to the client and back. Next.js **encrypts** them with a per-build private key, so an action can only be invoked against the build that created it. Do not lean on this: the rule stays "don't close over secrets."

When you run several server instances, they each generate their own key and an action encrypted by one cannot be decrypted by another — the classic *"Failed to find Server Action"* error. Pin the key instead:

```bash
openssl rand -base64 32
```

Set the result as `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`; it must be base64 whose decoded length is a valid AES key size (16, 24 or 32 bytes — Next.js generates 32). Rotate and sign it like any other key. The deployment side of this is in [NextJs_Docker_CI_CD.md](NextJs_Docker_CI_CD.md).

### Allowed origins (CSRF)

Because actions can be invoked from a `<form>`, they are CSRF-shaped. Two defences are already in place: actions only accept `POST`, and Next.js compares the `Origin` header against `Host` (or `X-Forwarded-Host`), aborting on mismatch. With SameSite cookies being the browser default, that covers most cases.

Behind a reverse proxy or a multi-layer backend, the production domain and the server's idea of its host can legitimately differ. Declare the safe origins rather than disabling the check:

```js filename="next.config.js"
/** @type {import('next').NextConfig} */
module.exports = {
  experimental: {
    serverActions: {
      allowedOrigins: ['my-proxy.com', '*.my-proxy.com'],
    },
  },
}
```

### Never mutate during render

Logging a user out, writing to the database, invalidating a cache — none of these belong in a render pass, in either Server or Client Components. Next.js blocks setting cookies and revalidating caches during render for exactly this reason.

```tsx filename="app/page.tsx"
// BAD: triggering a mutation during rendering
export default async function Page({ searchParams }) {
  if ((await searchParams).logout) {
    const cookieStore = await cookies()
    cookieStore.delete('AUTH_TOKEN')
  }

  return <UserProfile />
}
```

```tsx filename="app/page.tsx"
// GOOD: a Server Action handles the mutation
import { logout } from './actions'

export default function Page() {
  return (
    <>
      <UserProfile />
      <form action={logout}>
        <button type="submit">Logout</button>
      </form>
    </>
  )
}
```

That mutations go through `POST` is also why GET requests can't produce side effects by accident.

## Environment variables

Two rules carry most of the weight:

1. Environment variables are **server-only by default**. Prefixing one with `NEXT_PUBLIC_` inlines its value into the client bundle at `next build` — that is publication, not configuration.
2. `.env*` files belong in `.gitignore`. The `create-next-app` template does this for you; verify it anyway.

Because `NEXT_PUBLIC_` values are inlined at build time, they are **frozen into the artifact**. Promoting one Docker image across staging and production cannot change them. Server-side variables have no such problem — read during dynamic rendering, they are evaluated per request:

```tsx filename="app/page.ts" switcher
import { connection } from 'next/server'

export default async function Component() {
  await connection()
  // cookies, headers and other Request-time APIs also opt into dynamic
  // rendering, which is what makes this env variable a runtime value
  const value = process.env.MY_VALUE
  // ...
}
```

Note also that only literal `process.env.NEXT_PUBLIC_X` references are inlined — `process.env[varName]` is not, and will simply be `undefined` in the browser.

## Content Security Policy

CSP tells the browser which origins may supply scripts, styles, images, fonts, frames and so on. It is the main defence against XSS, clickjacking and other injection attacks, and there are two ways to deploy it — with nonces or without — that differ enormously in cost.

### With nonces, via proxy

A [nonce](https://developer.mozilla.org/docs/Web/HTML/Global_attributes/nonce) is a one-time random string that whitelists specific inline scripts. It must be unpredictable and **fresh on every request**, which is why nonces require dynamic rendering.

```ts filename="proxy.ts" switcher
import { NextRequest, NextResponse } from 'next/server'

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const isDev = process.env.NODE_ENV === 'development'
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''};
    style-src 'self' 'nonce-${nonce}';
    img-src 'self' blob: data:;
    font-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
`
  // Collapse newlines and repeated spaces
  const contentSecurityPolicyHeaderValue = cspHeader
    .replace(/\s{2,}/g, ' ')
    .trim()

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)

  requestHeaders.set(
    'Content-Security-Policy',
    contentSecurityPolicyHeaderValue
  )

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })
  response.headers.set(
    'Content-Security-Policy',
    contentSecurityPolicyHeaderValue
  )

  return response
}
```

> **Good to know:** `'unsafe-eval'` is needed in **development** only — React uses `eval` to rebuild server error stacks in the browser. Neither React nor Next.js use `eval` in production by default.

Proxy runs on every request unless you narrow it. Skip prefetches and static assets, which don't need the header:

```ts filename="proxy.ts" switcher
export const config = {
  matcher: [
    /*
     * Match all request paths except those starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
```

You do not attach the nonce to each tag yourself. Next.js parses the `Content-Security-Policy` header on the request, extracts the value from the `'nonce-{value}'` pattern, and applies it to framework scripts, page bundles, its own inline styles and scripts, and any `<Script nonce={...}>`. Read it in a Server Component when a third-party script needs it:

```tsx filename="app/page.tsx" switcher
import { headers } from 'next/headers'
import Script from 'next/script'

export default async function Page() {
  const nonce = (await headers()).get('x-nonce')

  return (
    <Script
      src="https://www.googletagmanager.com/gtag/js"
      strategy="afterInteractive"
      nonce={nonce}
    />
  )
}
```

Pages that must be dynamic can be forced with `connection()`:

```tsx filename="app/page.tsx" switcher
import { connection } from 'next/server'

export default async function Page() {
  // wait for an incoming request to render this page
  await connection()
  // Your page content
}
```

### The price of nonces

This is the part worth reading twice before committing. Nonces force **every page to render dynamically**, and that cascades:

- Static optimization and ISR are disabled
- Pages cannot be cached by a CDN without extra work
- **PPR is incompatible** — the static shell's scripts have no nonce to receive
- Slower first loads, more server load, higher hosting cost

Pages will still *build*; they fail at runtime if they aren't set up for dynamic rendering. See [NextJs_Rendering.md](NextJs_Rendering.md) and [NextJs_Caching.md](NextJs_Caching.md) for what you are giving up.

Take the trade when you have strict requirements that forbid `'unsafe-inline'`, you handle sensitive data, you need to allow some inline scripts but not others, or compliance mandates a strict CSP.

### Without nonces

If you don't need that, set the header statically in `next.config.js` and keep your static pages static:

```js filename="next.config.js"
const isDev = process.env.NODE_ENV === 'development'

const cspHeader = `
    default-src 'self';
    script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''};
    style-src 'self' 'unsafe-inline';
    img-src 'self' blob: data:;
    font-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
`

module.exports = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: cspHeader.replace(/\n/g, ''),
          },
        ],
      },
    ]
  },
}
```

### Subresource Integrity (experimental)

SRI is the middle path: hashes of your JavaScript are computed at **build time** and emitted as `integrity` attributes, so the browser verifies the files without needing a per-request nonce.

```js filename="next.config.js"
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    sri: {
      algorithm: 'sha256', // or 'sha384' or 'sha512'
    },
  },
}

module.exports = nextConfig
```

You keep static generation, CDN caching and build-time integrity. The limits: it is experimental, App Router only, and build-time only — dynamically generated scripts are out of scope. Available since `v14.0.0`.

### When CSP breaks things

- **Inline styles** — use a CSS-in-JS library that supports nonces, or move the styles into files
- **Dynamic imports** — make sure `script-src` permits them
- **WebAssembly** — add `'wasm-unsafe-eval'`
- **Service workers** — give them their own policy
- **Third-party scripts** — add the domains explicitly, e.g. `script-src ... https://www.googletagmanager.com; connect-src 'self' https://www.google-analytics.com;`

In production the usual failures are a proxy `matcher` that doesn't cover the route, and a policy that blocks Next.js's own static assets.

## Audit checklist

What the Next.js team suggests looking at hardest when reviewing a project:

- **Data Access Layer** — does one exist, and are database packages and `process.env` genuinely absent outside it?
- **`"use client"` files** — do the prop types ask for private data? Are the signatures too broad?
- **`"use server"` files** — are arguments validated? Is the user re-authorized inside the action? Is resource **ownership** checked, not just login? Are return values filtered? Is database access delegated to a `server-only` DAL?
- **`/[param]/` folders** — brackets mean user input. Is it validated?
- **`proxy.ts` and `route.ts`** — these have the most power in the app. Audit them with traditional techniques, and run penetration testing or vulnerability scanning on a regular cadence.

## Summary

The App Router is secure by default in the one way that matters most — Server and Client Components run in isolated module systems, so a Client Component cannot reach the database or `process.env` no matter what it imports. Everything else is about the data *you* hand across that line, and the endpoints you create without meaning to.

Two habits cover most of it. First, funnel reads and writes through a `server-only` Data Access Layer that authorizes, then returns a DTO — so "what can the client see?" has one answer in one place. Second, treat every Server Action as a public POST endpoint: authenticate, authorize against the specific resource, validate the arguments, and return only what the UI needs.

For headers, decide the CSP question on cost: nonces buy you a strict policy and cost you static rendering, ISR and PPR. If you don't need `'unsafe-inline'` gone, a static policy in `next.config.js` — or experimental SRI — gets you most of the protection for none of the performance.

## Further reading

* [Data Security](/docs/app/guides/data-security) — the guide this note condenses
* [Content Security Policy](/docs/app/guides/content-security-policy)
* [Environment Variables](/docs/app/guides/environment-variables)
* [Authentication](/docs/app/guides/authentication)
* [`taint`](/docs/app/api-reference/config/next-config-js/taint)
* [`serverActions.allowedOrigins`](/docs/app/api-reference/config/next-config-js/serverActions)
* [Security and Server Actions](https://nextjs.org/blog/security-nextjs-server-components-actions) — the Next.js team's write-up
* [Strict CSP example](https://github.com/vercel/next.js/tree/canary/examples/with-strict-csp)
