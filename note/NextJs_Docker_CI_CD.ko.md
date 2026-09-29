# Docker와 CI/CD

Docker 배포는 Next.js의 **모든** 기능을 지원합니다 — 컨테이너는 `next start`를 실행하는 장소일 뿐이고, Docker를 실행하는 제공자면 쿠버네티스든 모든 클라우드의 컨테이너 서비스든 어디든 됩니다. 그럼에도 별도의 노트가 필요한 이유는 "빌드된다"와 "200MB 이미지로 빌드되고 레플리카 다섯 개에 걸친 롤링 배포에서도 살아남는다" 사이의 간극 때문입니다.

그 간극은 세 부분으로 나뉩니다. 최소한의 산출물 만들기(`output: 'standalone'`), 컨테이너가 하나를 넘는 순간 깨지는 것들 설정하기(빌드 ID, 암호화 키, 공유 캐시), 그리고 CI에서 빌드를 빠르게 유지하기(`.next/cache`)입니다. 그 아래에 깔린 배포 개념 — 셀프 호스팅, 캐시 핸들러, 운영 체크리스트 — 은 [NextJs_Deployment.md](NextJs_Deployment.md)에 있습니다.

## 출력 파일 추적(output file tracing)

`next build` 동안 Next.js는 [`@vercel/nft`](https://github.com/vercel/nft)를 사용해 모든 페이지에 걸쳐 `import`, `require`, `fs` 사용을 정적으로 분석하고, 런타임에 필요한 파일이 정확히 무엇인지 알아냅니다. 결과는 `.next/` 안의 `.nft.json` 파일들로 남으며, 여기에는 프로덕션 서버 자체를 위한 `.next/next-server.js.nft.json`도 포함됩니다.

`next start`를 실행하려고 `dependencies` 전체를 설치해야 했던 예전의 Docker 문제를 없앤 것이 바로 이것입니다.

## `output: 'standalone'`

추적 결과를 배포 가능한 폴더로 바꾸는 데는 한 줄이면 충분합니다.

```js filename="next.config.js"
module.exports = {
  output: 'standalone',
}
```

이제 `next build`는 `.next/standalone`도 함께 씁니다 — 추적된 런타임 파일과 필요한 만큼의 `node_modules`, 그리고 최소한의 `server.js`입니다. 이 폴더는 **`npm install` 없이** 단독으로 실행됩니다.

```bash filename="Terminal"
node .next/standalone/server.js
```

한 가지 날카로운 지점이 있습니다. `server.js`는 CDN이 서빙할 것이라는 가정 아래 `public`과 `.next/static`을 복사하지 **않습니다**. 컨테이너가 그것들을 서빙하길 원한다면 직접 복사해 넣으면 `server.js`가 자동으로 집어 갑니다.

```bash filename="Terminal"
cp -r public .next/standalone/ && cp -r .next/static .next/standalone/.next/
```

> **알아두면 좋은 점:** `server.js`는 환경에서 `PORT`와 `HOSTNAME`을 읽습니다. `PORT=8080 HOSTNAME=0.0.0.0 node server.js`는 `http://0.0.0.0:8080`에서 서빙하며 — `localhost`가 아니라 `0.0.0.0`이어야 컨테이너 밖에서 포트에 닿을 수 있습니다.

### 추적의 주의점

모노레포에서는 추적이 기본적으로 프로젝트 디렉터리를 루트로 삼으므로, `next build packages/web-app`은 `packages/web-app` 위의 어떤 것도 포함하지 않습니다. 루트를 넓히세요.

```js filename="packages/web-app/next.config.js"
const path = require('path')

module.exports = {
  // 모노레포 기준으로 두 단계 위의 파일까지 포함합니다
  outputFileTracingRoot: path.join(__dirname, '../../'),
}
```

추적이 파일을 놓치는 경우도 가끔 있습니다 — 보통 네이티브 바이너리이거나, 분석기가 볼 수 없는 경로로 로드되는 런타임 자산입니다. 라우트 단위로 고치세요. 키는 **라우트 glob**, 값은 **프로젝트 루트 기준으로 해석되는 glob**입니다.

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

패턴은 좁게 유지하고 — 레포 루트의 `**/*`는 과도한 크기의 추적을 만듭니다 — 크로스 플랫폼 동작을 위해 슬래시를 쓰세요. 이 옵션들은 서버 추적 파일을 만드는 라우트에만 영향을 줍니다. Edge Runtime 라우트와 완전 정적 페이지는 영향을 받지 않습니다. `src/` 디렉터리를 쓰더라도 키는 여전히 라우트 경로와 매칭되고, 값은 프로젝트 루트에서 해석되므로 `src/…`를 참조할 수 있습니다.

## 멀티 스테이지 Dockerfile

번들된 문서는 Dockerfile을 인라인하지 않고 [`with-docker` 예제](https://github.com/vercel/next.js/tree/canary/examples/with-docker)로 링크합니다. 아래는 그 예제의 형태입니다 — 소스 트리도 전체 `node_modules`도 최종 이미지에 들어가지 않도록 세 단계로 나눕니다.

```dockerfile filename="Dockerfile"
FROM node:22-alpine AS base

# 1. 락파일이 바뀔 때만 의존성 설치
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# 2. 앱 빌드
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# 3. 실행 — standalone 출력만 여기에 들어옵니다
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
# standalone 출력에는 추적된 node_modules가 이미 포함되어 있습니다
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
# 컨테이너 밖에서 포트에 닿을 수 있도록 모든 인터페이스에 바인딩합니다
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

세 가지 세부 사항이 일을 합니다. `libc6-compat`이 있는 이유는 Alpine이 musl을 쓰는데 이미지 최적화에 필요한 `sharp`는 glibc를 기대하기 때문입니다. `deps`를 따로 복사하므로 소스만 바뀐 경우에는 패키지를 다시 설치하지 않습니다. 그리고 runner 단계는 `.next/standalone`, `.next/static`, `public`*만* 복사하는데, 최종 이미지가 작은 이유가 그것입니다.

빌드 컨텍스트를 작게 유지하고 오래된 산출물이 빌더에 들어가지 않도록 `.dockerignore`와 함께 쓰세요.

```text filename=".dockerignore"
node_modules
.next
.git
npm-debug.log
README.md
.env*.local
```

알아둘 만한 예제가 두 개 더 있습니다. 정적 `output: 'export'` 앱을 가벼운 컨테이너에서 서빙하는 [Docker Export Output](https://github.com/vercel/next.js/tree/canary/examples/with-docker-export-output), 그리고 개발/스테이징/운영 설정을 분리하는 [Docker Multi-Environment](https://github.com/vercel/next.js/tree/canary/examples/with-docker-multi-env)입니다.

> **개발 환경 참고:** Docker는 운영에는 훌륭하지만, Mac과 Windows에서는 로컬에서 그냥 `npm run dev`를 쓰는 편이 낫습니다 — 바인드 마운트 파일 시스템 성능 때문에 컨테이너화된 개발 루프가 눈에 띄게 느려집니다.

## 하나의 이미지, 여러 환경

컨테이너의 약속은 한 번 빌드해 같은 산출물을 스테이징과 운영으로 승격시키는 것입니다. Next.js는 이를 지원하지만, 한 가지 확실한 한계가 있습니다.

서버 측 환경 변수는 런타임에 읽힙니다. 그 읽기가 동적 렌더링 중에 일어나기만 한다면요.

```tsx filename="app/page.ts" switcher
import { connection } from 'next/server'

export default async function Component() {
  await connection()
  // cookies, headers 등 Request 시점 API도
  // 동적 렌더링을 선택하게 되며, 그래서
  // 이 환경 변수가 런타임에 평가됩니다
  const value = process.env.MY_VALUE
  // ...
}
```

`NEXT_PUBLIC_` 변수는 이렇게 동작할 수 없습니다. **`next build` 중에 JavaScript 번들에 인라인되므로** 이미지 빌드 시점에 값이 고정됩니다. 하나의 이미지가 환경마다 다른 public 값을 들고 다니는 것은 정말로 불가능합니다 — 환경별로 빌드하거나, 그 값들을 런타임에 자체 API로 제공해야 합니다. Next.js에서 가장 흔한 Docker 관련 놀라움입니다.

## 컨테이너를 둘 이상 실행할 때

로드 밸런서가 여러 인스턴스 앞에 서는 순간 네 가지를 고정해야 합니다. 각각은 간헐적 버그처럼 보이는 방식으로 실패합니다.

### 일관된 빌드 ID

Next.js는 `next build` 중에 어떤 버전이 서빙되고 있는지 식별하는 ID를 생성합니다. **모든 컨테이너를 같은 빌드로 띄워야 합니다.** 파이프라인이 환경마다 다시 빌드한다면 대신 ID를 결정적으로 생성하세요.

```jsx filename="next.config.js"
module.exports = {
  generateBuildId: async () => {
    // 무엇이든 될 수 있습니다. 여기서는 최신 git 해시를 사용합니다
    return process.env.GIT_HASH
  },
}
```

> **알아두면 좋은 점:** `deploymentId`가 설정되면 Next.js는 고정된 빌드 ID를 사용하고 `generateBuildId`는 효력이 없습니다 — 버전 불일치는 배포 ID로 감지됩니다.

### Server Function 암호화 키

Next.js는 Server Function의 클로저 변수를 클라이언트로 보내기 전에 암호화하며, 키는 빌드마다 새로 생성됩니다. 빌드나 키가 다른 두 컨테이너는 서로의 액션을 복호화하지 못하고, 이는 요청이 어느 인스턴스에 도달했느냐에 따라 **"Failed to find Server Action"** 으로 나타납니다.

모든 인스턴스가 하나의 키를 쓰도록 고정하세요.

```bash
NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=your-generated-key next build
```

키는 디코딩된 길이가 16, 24, 32바이트인 base64여야 합니다(Next.js는 32바이트를 생성합니다 — `openssl rand -base64 32`). 키는 빌드 출력에 포함되어 런타임에 자동으로 사용됩니다. 이에 대한 보안 맥락은 [NextJs_Security.md](NextJs_Security.md)에 있습니다.

### 배포 ID와 버전 불일치

롤링 배포 중에는 일부 클라이언트가 이전 빌드의 자산을 들고 있는 동안 새 빌드가 이미 서빙되고 있습니다. [버전 불일치(version skew)](/docs/app/glossary#version-skew)는 사라진 JS/CSS 파일, 서버가 더 이상 인식하지 못하는 Server Function ID, 새 서버가 쓸 수 없는 프리페치된 페이지 데이터로 나타납니다.

```js filename="next.config.js"
module.exports = {
  deploymentId: process.env.DEPLOYMENT_VERSION,
}
```

배포 ID가 설정되면 정적 자산에 `?dpl=<deploymentId>`가 붙고, 클라이언트 내비게이션은 `x-deployment-id` 헤더를 보내며, 서버가 둘을 비교합니다. 불일치하면 Next.js는 클라이언트 측 내비게이션 대신 **하드 내비게이션** — 전체 페이지 새로고침 — 을 수행하므로, 클라이언트가 일관된 자산 집합을 받게 됩니다.

> **알아두면 좋은 점:** 그 새로고침은 내비게이션을 견디도록 설계되지 않은 상태를 잃습니다. URL 상태와 로컬 스토리지는 유지되지만 `useState`는 아닙니다.

### 공유 캐시

기본 캐시는 인메모리이며 인스턴스별입니다. 쿠버네티스에서는 모든 파드가 자기 복사본을 가지므로, 한 파드에서의 `revalidateTag()`는 다른 파드들이 낡은 콘텐츠를 계속 서빙하게 둡니다. 외부 저장소로 뒷받침되는 커스텀 캐시 핸들러와 함께 [`'use cache: remote'`](/docs/app/api-reference/directives/use-cache-remote)를 사용하고, 인스턴스들이 무효화를 알 수 있도록 `refreshTags()`를 구현하세요. 핸들러 자체는 [NextJs_Deployment.md](NextJs_Deployment.md)에서 다룹니다.

## CI 빌드 캐싱

Next.js는 빌드 간에 공유되는 캐시를 `.next/cache`에 씁니다. CI에서는 명시적으로 보존하지 않으면 이 디렉터리가 러너와 함께 버려집니다 — 그리고 캐시가 없으면 [No Cache Detected](/docs/messages/no-cache) 경고와 함께 매번 전체 재빌드를 하게 됩니다.

규칙은 어디서나 같습니다. **락파일을 키로 삼아 `node_modules`와 함께 `.next/cache`를 캐시하세요.**

### GitHub Actions

```yaml
uses: actions/cache@v4
with:
  # `yarn`, `bun` 등 다른 패키지 매니저의 캐싱은 https://github.com/actions/cache/blob/main/examples.md 참고, 또는 actions/setup-node의 캐싱 활용
  path: |
    ~/.npm
    ${{ github.workspace }}/.next/cache
  # 패키지나 소스 파일이 바뀔 때마다 새 캐시를 생성합니다.
  key: ${{ runner.os }}-nextjs-${{ hashFiles('**/package-lock.json') }}-${{ hashFiles('**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx') }}
  # 패키지는 그대로이고 소스만 바뀌었다면 이전 캐시에서 재빌드합니다.
  restore-keys: |
    ${{ runner.os }}-nextjs-${{ hashFiles('**/package-lock.json') }}-
```

베껴 쓸 가치가 있는 패턴은 두 단계 키입니다. 깔끔한 히트를 위한 소스 해시 포함 정확 키, 그리고 소스만 바뀌었을 때 아무것도 없는 상태가 아니라 이전 빌드의 캐시에서 출발하게 해주는 `restore-keys` 접두사입니다.

### GitLab CI

```yaml
cache:
  key: ${CI_COMMIT_REF_SLUG}
  paths:
    - node_modules/
    - .next/cache/
```

### CircleCI

`.circleci/config.yml`의 기존 `save_cache` 단계에 `.next/cache`를 추가합니다.

```yaml
steps:
  - save_cache:
      key: dependency-cache-{{ checksum "yarn.lock" }}
      paths:
        - ./node_modules
        - ./.next/cache
```

### Bitbucket Pipelines

`bitbucket-pipelines.yml`의 최상위에 캐시를 정의한 뒤 step에서 참조합니다.

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

`next build`를 실행하는 작업보다 앞에 이 태스크를 추가합니다.

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
    - 'node_modules/**/*' # `yarn`이나 `npm i`를 빠르게 하기 위해 `node_modules` 캐시
    - '.next/cache/**/*' # 애플리케이션 재빌드를 빠르게 하기 위해 Next.js 캐시
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

[Job Cacher](https://www.jenkins.io/doc/pipeline/steps/jobcacher/) 플러그인을 사용해 설치와 빌드를 모두 감쌉니다.

```groovy
stage("Restore npm packages") {
    steps {
        // GIT_COMMIT 해시를 기준으로 락파일을 캐시에 씁니다
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
        // GIT_COMMIT 해시를 기준으로 락파일을 캐시에 씁니다
        writeFile file: "next-lock.cache", text: "$GIT_COMMIT"

        cache(caches: [
            arbitraryFileCache(
                path: ".next/cache",
                includes: "**/*",
                cacheValidityDecidingFile: "next-lock.cache"
            )
        ]) {
            // 즉 `next build`
            sh "npm run build"
        }
    }
}
```

### Netlify와 Vercel

Netlify: [Netlify Plugins](https://www.netlify.com/products/build/plugins/)와 [`@netlify/plugin-nextjs`](https://www.npmjs.com/package/@netlify/plugin-nextjs)를 사용하세요. Vercel: 캐싱이 자동으로 설정되므로 할 일이 없습니다.

## 파이프라인 전체

조각을 모으면, 한 번 빌드해 승격시키는 워크플로는 이렇게 생겼습니다.

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
          # 이 빌드의 모든 레플리카가 하나의 키를 공유하도록 고정합니다
          NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: ${{ secrets.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY }}
          # 롤링 배포 중 버전 불일치 보호
          DEPLOYMENT_VERSION: ${{ github.sha }}
        run: docker build -t myapp:${{ github.sha }} .

      - run: docker push myapp:${{ github.sha }}
```

여기에 두 가지 주석을 답니다. 암호화 키는 저장소가 아니라 CI 시크릿에서 옵니다 — 데이터베이스 비밀번호와 같은 의미의 비밀 값입니다. 그리고 이미지는 `latest`가 아니라 커밋 SHA로 태그하므로, 문제가 생겼을 때 배포 ID와 이미지 태그와 git 이력이 모두 같은 빌드를 가리킵니다.

여기에 더해, CI는 이미 게이트 역할을 하는 `next build`를 반드시 실행해야 합니다. 타입 에러, 실패한 프리렌더, 라우트 충돌을 레지스트리에 닿기 전에 잡아 줍니다.

## 요약

`output: 'standalone'`이 Next.js 컨테이너를 합리적으로 만들어 줍니다 — 출력 파일 추적이 런타임 파일을 알아내고, 빌드는 `npm install`이 필요 없는 자족적 폴더와 `server.js`를 함께 내보냅니다. CDN이 서빙하지 않는다면 `public`과 `.next/static`을 직접 복사해 넣고, `HOSTNAME=0.0.0.0`을 설정하지 않으면 컨테이너 밖에서 포트가 응답하지 않습니다.

컨테이너가 하나를 넘는 순간 네 가지 설정이 선택 사항이 아니게 됩니다. 하나의 공유 빌드(또는 결정적인 `generateBuildId`), 고정된 `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`, 롤링 배포 중 버전 불일치를 위한 `deploymentId`, 그리고 재검증이 전파되도록 하는 공유 캐시 핸들러입니다. 넷 모두 빠뜨리면 간헐적으로, 로드 밸런서에 따라 실패하므로 디버깅 비용은 비싸고 미리 제대로 설정하는 비용은 쌉니다.

CI에서는 락파일을 키로 하고 `restore-keys` 폴백을 둔 채 `.next/cache`를 보존하세요. 그리고 승격할 수 없는 것을 기억하세요. `NEXT_PUBLIC_` 값은 빌드 시점에 인라인되므로, 하나의 이미지가 환경마다 다른 public 설정을 들고 다닐 수 없습니다.

## 더 읽을거리

* [Deploying](/docs/app/getting-started/deploying) — 네 가지 배포 대상 중 Docker
* [`output`](/docs/app/api-reference/config/next-config-js/output) — 파일 추적과 standalone
* [Self-Hosting](/docs/app/guides/self-hosting) — 다중 서버 배포와 버전 불일치
* [CI Build Caching](/docs/app/guides/ci-build-caching) — 전체 제공자 목록
* [`deploymentId`](/docs/app/api-reference/config/next-config-js/deploymentId)
* [`cacheHandlers`](/docs/app/api-reference/config/next-config-js/cacheHandlers)
* [Local Development](/docs/app/guides/local-development) — 개발 루프를 Docker로 감싸지 말아야 하는 이유
* [`with-docker` 예제](https://github.com/vercel/next.js/tree/canary/examples/with-docker)
* [Docker 공식 Next.js 가이드](https://docs.docker.com/guides/nextjs)
