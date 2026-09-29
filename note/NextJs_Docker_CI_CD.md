# Docker and CI/CD

Docker deployments support **all** Next.js features — the container is just a place to run `next start`, and any provider that runs Docker will do, including Kubernetes and the container services of every cloud. What makes it worth a note of its own is the gap between "it builds" and "it builds into a 200 MB image that survives a rolling deployment across five replicas."

That gap has three parts: producing a minimal artifact (`output: 'standalone'`), configuring the things that break once more than one container is running (build IDs, encryption keys, shared cache), and keeping the build fast in CI (`.next/cache`). The deployment concepts underneath — self-hosting, cache handlers, the production checklist — are in [NextJs_Deployment.md](NextJs_Deployment.md).

## Output file tracing

During `next build`, Next.js uses [`@vercel/nft`](https://github.com/vercel/nft) to statically analyze `import`, `require` and `fs` usage across every page, and works out exactly which files are needed at runtime. The results land in `.nft.json` files in `.next/`, including `.next/next-server.js.nft.json` for the production server itself.

This is what removed the old Docker problem of having to install all of `dependencies` just to run `next start`.

## `output: 'standalone'`

Turning tracing into a deployable folder takes one line:

```js filename="next.config.js"
module.exports = {
  output: 'standalone',
}
```

`next build` now also writes `.next/standalone` — the traced runtime files plus the necessary parts of `node_modules`, and a minimal `server.js`. That folder runs on its own, with **no `npm install`**:

```bash filename="Terminal"
node .next/standalone/server.js
```

The one sharp edge: `server.js` does **not** copy `public` or `.next/static`, on the assumption that a CDN serves them. If you want the container to serve them, copy them in and `server.js` picks them up automatically:

```bash filename="Terminal"
cp -r public .next/standalone/ && cp -r .next/static .next/standalone/.next/
```

> **Good to know:** `server.js` reads `PORT` and `HOSTNAME` from the environment. `PORT=8080 HOSTNAME=0.0.0.0 node server.js` serves on `http://0.0.0.0:8080` — and `0.0.0.0` rather than `localhost` is what makes the port reachable from outside the container.

### Tracing caveats

In a monorepo, tracing is rooted at the project directory by default, so `next build packages/web-app` will not include anything above `packages/web-app`. Widen the root:

```js filename="packages/web-app/next.config.js"
const path = require('path')

module.exports = {
  // this includes files from the monorepo base two directories up
  outputFileTracingRoot: path.join(__dirname, '../../'),
}
```

Tracing occasionally misses a file — typically a native binary or a runtime asset loaded by a path the analyzer can't see. Fix it per route. Keys are **route globs**, values are **globs resolved from the project root**:

```js filename="next.config.js"
module.exports = {
  outputFileTracingExcludes: {
    '/api/hello': ['./un-necessary-folder/**/*'],
  },
  outputFileTracingIncludes: {
    '/*': ['node_modules/sharp/**/*', 'node_modules/aws-crt/dist/bin/**/*'],
  },
}
```

Keep the patterns narrow — `**/*` at the repo root produces an oversized trace — and prefer forward slashes for cross-platform behaviour. These options only affect routes that produce a server trace: Edge Runtime routes and fully static pages are untouched. With a `src/` directory, keys still match route paths while values may reference `src/…`, since they resolve from the project root.

## A multi-stage Dockerfile

The bundled docs link to the [`with-docker` example](https://github.com/vercel/next.js/tree/canary/examples/with-docker) rather than inlining a Dockerfile. This is that example's shape — three stages, so neither the source tree nor the full `node_modules` ends up in the final image:

```dockerfile filename="Dockerfile"
FROM node:22-alpine AS base

# 1. Install dependencies only when the lockfile changes
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# 2. Build the app
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# 3. Run it — only the standalone output lands here
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
# The standalone output already contains the traced node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
# Bind to all interfaces so the port is reachable from outside the container
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

Three details do the work. `libc6-compat` is there because Alpine uses musl and `sharp` — required for Image Optimization — expects glibc. Copying `deps` separately means a source-only change doesn't reinstall packages. And the runner stage copies *only* `.next/standalone`, `.next/static` and `public`, which is why the final image is small.

Pair it with a `.dockerignore` so the build context stays small and stale artifacts never reach the builder:

```text filename=".dockerignore"
node_modules
.next
.git
npm-debug.log
README.md
.env*.local
```

Two other examples are worth knowing: [Docker Export Output](https://github.com/vercel/next.js/tree/canary/examples/with-docker-export-output) for a static `output: 'export'` app served from a lightweight container, and [Docker Multi-Environment](https://github.com/vercel/next.js/tree/canary/examples/with-docker-multi-env) for separate dev/staging/production configurations.

> **Note for development:** Docker is excellent for production, but on Mac and Windows prefer plain `npm run dev` locally — bind-mount filesystem performance makes the containerized dev loop noticeably slower.

## One image, many environments

The promise of containers is building once and promoting the same artifact through staging and production. Next.js supports that, with one hard limit.

Server-side environment variables are read at runtime, so long as the read happens during dynamic rendering:

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

`NEXT_PUBLIC_` variables cannot work this way. They are **inlined into the JavaScript bundle during `next build`**, so their values are frozen at image-build time. One image genuinely cannot carry different public values per environment — you either build per environment, or serve those values from your own API at runtime. This is the single most common Docker surprise in Next.js.

## Running more than one container

Four things need pinning once a load balancer sits in front of several instances. Each of them fails in a way that looks like a random intermittent bug.

### A consistent build ID

Next.js generates an ID during `next build` to identify which version is being served. **The same build should be used to boot all containers.** If your pipeline rebuilds per environment, generate the ID deterministically instead:

```jsx filename="next.config.js"
module.exports = {
  generateBuildId: async () => {
    // This could be anything, using the latest git hash
    return process.env.GIT_HASH
  },
}
```

> **Good to know:** when `deploymentId` is set, Next.js uses a constant build ID and `generateBuildId` has no effect — version skew is detected from the deployment ID instead.

### The Server Functions encryption key

Next.js encrypts Server Function closure variables before sending them to the client, using a key generated fresh per build. Two containers built or keyed differently cannot decrypt each other's actions, which surfaces as **"Failed to find Server Action"** on whichever instance the request happened to land on.

Pin one key for all instances:

```bash
NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=your-generated-key next build
```

The key must be base64 with a decoded length of 16, 24 or 32 bytes (Next.js generates 32 — `openssl rand -base64 32`). It is embedded in the build output and used automatically at runtime. The security context for this is in [NextJs_Security.md](NextJs_Security.md).

### Deployment ID and version skew

During a rolling deployment, some clients hold assets from the old build while the new one is already serving. [Version skew](/docs/app/glossary#version-skew) shows up as missing JS/CSS files, Server Function IDs the server no longer recognizes, and prefetched page data that the new server can't use.

```js filename="next.config.js"
module.exports = {
  deploymentId: process.env.DEPLOYMENT_VERSION,
}
```

With a deployment ID set, static assets carry `?dpl=<deploymentId>`, client navigations send an `x-deployment-id` header, and the server compares the two. On a mismatch Next.js does a **hard navigation** — a full page reload — instead of a client-side one, so the client picks up a consistent set of assets.

> **Good to know:** that reload loses any state not designed to survive navigation. URL state and local storage persist; `useState` does not.

### Shared cache

The default cache is in-memory and per-instance. Under Kubernetes every pod holds its own copy, so a `revalidateTag()` on one pod leaves the others serving stale content. Use [`'use cache: remote'`](/docs/app/api-reference/directives/use-cache-remote) with a custom cache handler backed by external storage, and implement `refreshTags()` so instances learn about invalidations. The handler itself is covered in [NextJs_Deployment.md](NextJs_Deployment.md).

## CI build caching

Next.js writes a cache to `.next/cache` that is shared between builds. In CI, that directory is thrown away with the runner unless you persist it explicitly — and when it is missing you get the [No Cache Detected](/docs/messages/no-cache) warning and a full rebuild every time.

The rule is the same everywhere: **cache `.next/cache` alongside `node_modules`, keyed on the lockfile.**

### GitHub Actions

```yaml
uses: actions/cache@v4
with:
  # See here for caching with `yarn`, `bun` or other package managers https://github.com/actions/cache/blob/main/examples.md or you can leverage caching with actions/setup-node
  path: |
    ~/.npm
    ${{ github.workspace }}/.next/cache
  # Generate a new cache whenever packages or source files change.
  key: ${{ runner.os }}-nextjs-${{ hashFiles('**/package-lock.json') }}-${{ hashFiles('**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx') }}
  # If source files changed but packages didn't, rebuild from a prior cache.
  restore-keys: |
    ${{ runner.os }}-nextjs-${{ hashFiles('**/package-lock.json') }}-
```

The two-level key is the pattern worth copying: an exact key including source hashes for a clean hit, and a `restore-keys` prefix so a source-only change still starts from the previous build's cache instead of from nothing.

### GitLab CI

```yaml
cache:
  key: ${CI_COMMIT_REF_SLUG}
  paths:
    - node_modules/
    - .next/cache/
```

### CircleCI

Add `.next/cache` to the existing `save_cache` step in `.circleci/config.yml`:

```yaml
steps:
  - save_cache:
      key: dependency-cache-{{ checksum "yarn.lock" }}
      paths:
        - ./node_modules
        - ./.next/cache
```

### Bitbucket Pipelines

Define the cache at the top level of `bitbucket-pipelines.yml`, then reference it from a step:

```yaml
definitions:
  caches:
    nextcache: .next/cache
```

```yaml
- step:
    name: your_step_name
    caches:
      - node
      - nextcache
```

### Azure Pipelines

Add the task somewhere before whatever runs `next build`:

```yaml
- task: Cache@2
  displayName: 'Cache .next/cache'
  inputs:
    key: next | $(Agent.OS) | yarn.lock
    path: '$(System.DefaultWorkingDirectory)/.next/cache'
```

### AWS CodeBuild

```yaml
cache:
  paths:
    - 'node_modules/**/*' # Cache `node_modules` for faster `yarn` or `npm i`
    - '.next/cache/**/*' # Cache Next.js for faster application rebuilds
```

### Travis CI

```yaml
cache:
  directories:
    - $HOME/.cache/yarn
    - node_modules
    - .next/cache
```

### Heroku

```javascript
"cacheDirectories": [".next/cache"]
```

### Jenkins

Using the [Job Cacher](https://www.jenkins.io/doc/pipeline/steps/jobcacher/) plugin, wrap both the install and the build:

```groovy
stage("Restore npm packages") {
    steps {
        // Writes lock-file to cache based on the GIT_COMMIT hash
        writeFile file: "next-lock.cache", text: "$GIT_COMMIT"

        cache(caches: [
            arbitraryFileCache(
                path: "node_modules",
                includes: "**/*",
                cacheValidityDecidingFile: "package-lock.json"
            )
        ]) {
            sh "npm install"
        }
    }
}
stage("Build") {
    steps {
        // Writes lock-file to cache based on the GIT_COMMIT hash
        writeFile file: "next-lock.cache", text: "$GIT_COMMIT"

        cache(caches: [
            arbitraryFileCache(
                path: ".next/cache",
                includes: "**/*",
                cacheValidityDecidingFile: "next-lock.cache"
            )
        ]) {
            // aka `next build`
            sh "npm run build"
        }
    }
}
```

### Netlify and Vercel

Netlify: use [Netlify Plugins](https://www.netlify.com/products/build/plugins/) with [`@netlify/plugin-nextjs`](https://www.npmjs.com/package/@netlify/plugin-nextjs). Vercel: caching is configured automatically — nothing to do.

## A pipeline, end to end

Putting the pieces together, a build-once-promote workflow looks like this:

```yaml filename=".github/workflows/deploy.yml"
name: Build and deploy

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - uses: actions/cache@v4
        with:
          path: ${{ github.workspace }}/.next/cache
          key: ${{ runner.os }}-nextjs-${{ hashFiles('**/package-lock.json') }}-${{ hashFiles('**/*.[jt]s', '**/*.[jt]sx') }}
          restore-keys: |
            ${{ runner.os }}-nextjs-${{ hashFiles('**/package-lock.json') }}-

      - run: npm ci
      - run: npm run lint
      - run: npm test

      - name: Build image
        env:
          # Pinned so every replica of this build shares one key
          NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: ${{ secrets.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY }}
          # Version skew protection during the rolling deploy
          DEPLOYMENT_VERSION: ${{ github.sha }}
        run: docker build -t myapp:${{ github.sha }} .

      - run: docker push myapp:${{ github.sha }}
```

Two notes on it. The encryption key comes from CI secrets, never from the repository — it is a secret in the same sense as a database password. And the image is tagged with the commit SHA rather than `latest`, so the deployment ID, the image tag and the git history all name the same build when something goes wrong.

Beyond this, CI should also run `next build` as the gate it already is: it catches type errors, failed prerenders and route conflicts before anything reaches a registry.

## Summary

`output: 'standalone'` is what makes a Next.js container reasonable — output file tracing works out the runtime files, and the build emits a self-contained folder plus a `server.js` that needs no `npm install`. Copy `public` and `.next/static` in yourself if a CDN isn't serving them, and set `HOSTNAME=0.0.0.0` or the port won't answer from outside the container.

Once more than one container runs, four settings stop being optional: one shared build (or a deterministic `generateBuildId`), a pinned `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`, a `deploymentId` for version skew during rolling deploys, and a shared cache handler so revalidation propagates. All four fail intermittently and load-balancer-dependently when missed, which makes them expensive to debug and cheap to set correctly up front.

In CI, persist `.next/cache` keyed on the lockfile with a `restore-keys` fallback. And remember what cannot be promoted: `NEXT_PUBLIC_` values are inlined at build time, so one image cannot carry different public configuration per environment.

## Further reading

* [Deploying](/docs/app/getting-started/deploying) — Docker among the four targets
* [`output`](/docs/app/api-reference/config/next-config-js/output) — file tracing and standalone
* [Self-Hosting](/docs/app/guides/self-hosting) — multi-server deployments and version skew
* [CI Build Caching](/docs/app/guides/ci-build-caching) — the full provider list
* [`deploymentId`](/docs/app/api-reference/config/next-config-js/deploymentId)
* [`cacheHandlers`](/docs/app/api-reference/config/next-config-js/cacheHandlers)
* [Local Development](/docs/app/guides/local-development) — why not to Docker the dev loop
* [`with-docker` example](https://github.com/vercel/next.js/tree/canary/examples/with-docker)
* [Docker's own Next.js guide](https://docs.docker.com/guides/nextjs)
