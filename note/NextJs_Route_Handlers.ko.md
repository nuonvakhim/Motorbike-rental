# 라우트 핸들러

라우트 핸들러를 사용하면 웹 표준 [Request](https://developer.mozilla.org/docs/Web/API/Request)와 [Response](https://developer.mozilla.org/docs/Web/API/Response) API로 특정 라우트에 대한 커스텀 요청 핸들러를 만들 수 있습니다.

![Route.js Special File](https://h8DxKfmAPhn8O0p3.public.blob.vercel-storage.com/docs/light/route-special-file.png)

> **알아두기**: 라우트 핸들러는 `app` 디렉터리 안에서만 사용할 수 있습니다. `pages` 디렉터리의 [API 라우트](/docs/pages/building-your-application/routing/api-routes)에 해당하는 기능이므로, API 라우트와 라우트 핸들러를 **함께 쓸 필요는 없습니다**.

## 규칙

라우트 핸들러는 `app` 디렉터리 안의 [`route.js|ts` 파일](/docs/app/api-reference/file-conventions/route)에 정의합니다.

```ts filename="app/api/route.ts" switcher
export async function GET(request: Request) {}
```

라우트 핸들러는 `page.js`나 `layout.js`처럼 `app` 디렉터리 안 어디에나 중첩해서 둘 수 있습니다. 다만 `page.js`와 **같은 라우트 세그먼트 레벨에는** `route.js` 파일을 둘 수 **없습니다**.

## 지원하는 HTTP 메서드

다음 [HTTP 메서드](https://developer.mozilla.org/docs/Web/HTTP/Methods)를 지원합니다: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`. 지원하지 않는 메서드가 호출되면 Next.js는 `405 Method Not Allowed` 응답을 반환합니다.

## 확장된 `NextRequest`와 `NextResponse` API

Next.js는 네이티브 [Request](https://developer.mozilla.org/docs/Web/API/Request), [Response](https://developer.mozilla.org/docs/Web/API/Response) API를 지원하는 것에 더해, 고급 사용 사례를 위한 편의 헬퍼를 제공하는 [`NextRequest`](/docs/app/api-reference/functions/next-request)와 [`NextResponse`](/docs/app/api-reference/functions/next-response)로 이를 확장합니다.

## 캐싱

라우트 핸들러는 기본적으로 캐시되지 않습니다. 다만 `GET` 메서드에 한해 캐싱을 선택할 수 있습니다. 그 외 지원하는 HTTP 메서드는 **캐시되지 않습니다**. `GET` 메서드를 캐시하려면 라우트 핸들러 파일에서 `export const dynamic = 'force-static'` 같은 [라우트 설정 옵션](/docs/app/guides/caching-without-cache-components#dynamic)을 사용하세요.

```ts filename="app/items/route.ts" switcher
export const dynamic = 'force-static'

export async function GET() {
  const res = await fetch('https://data.mongodb-api.com/...', {
    headers: {
      'Content-Type': 'application/json',
      'API-Key': process.env.DATA_API_KEY,
    },
  })
  const data = await res.json()

  return Response.json({ data })
}
```

> **알아두기**: 캐시된 `GET` 메서드와 같은 파일에 나란히 두더라도, 그 외 지원하는 HTTP 메서드는 **캐시되지 않습니다**.

### Cache Components와 함께 사용하기

[Cache Components](/docs/app/getting-started/caching)가 활성화되면 `GET` 라우트 핸들러는 애플리케이션의 일반 UI 라우트와 동일한 모델을 따릅니다. 기본적으로 요청 시점에 실행되고, 캐시되지 않은 데이터나 런타임 데이터에 접근하지 않으면 미리 렌더링될 수 있으며, `use cache`를 사용해 캐시되지 않은 데이터를 정적 응답에 포함시킬 수도 있습니다.

**정적 예시** — 캐시되지 않은 데이터나 런타임 데이터에 접근하지 않으므로 빌드 시점에 프리렌더링됩니다.

```tsx filename="app/api/project-info/route.ts"
export async function GET() {
  return Response.json({
    projectName: 'Next.js',
  })
}
```

**동적 예시** — 비결정적 연산에 접근합니다. 빌드 중 `Math.random()`이 호출되는 시점에 프리렌더링이 중단되고, 요청 시점 렌더링으로 넘어갑니다.

```tsx filename="app/api/random-number/route.ts"
export async function GET() {
  return Response.json({
    randomNumber: Math.random(),
  })
}
```

**런타임 데이터 예시** — 요청별 데이터에 접근합니다. `headers()` 같은 런타임 API가 호출되면 프리렌더링이 종료됩니다.

```tsx filename="app/api/user-agent/route.ts"
import { headers } from 'next/headers'

export async function GET() {
  const headersList = await headers()
  const userAgent = headersList.get('user-agent')

  return Response.json({ userAgent })
}
```

> **알아두기**: `GET` 핸들러가 네트워크 요청, 데이터베이스 쿼리, 비동기 파일 시스템 작업, 요청 객체 속성(`req.url`, `request.headers`, `request.cookies`, `request.body` 등), [`cookies()`](/docs/app/api-reference/functions/cookies)·[`headers()`](/docs/app/api-reference/functions/headers)·[`connection()`](/docs/app/api-reference/functions/connection) 같은 런타임 API, 또는 비결정적 연산에 접근하면 프리렌더링이 중단됩니다.

**캐시 예시** — 캐시되지 않은 데이터(데이터베이스 쿼리)에 접근하지만 `use cache`로 캐시하므로, 프리렌더링된 응답에 포함될 수 있습니다.

```tsx filename="app/api/products/route.ts"
import { cacheLife } from 'next/cache'

export async function GET() {
  const products = await getProducts()
  return Response.json(products)
}

async function getProducts() {
  'use cache'
  cacheLife('hours')

  return await db.query('SELECT * FROM products')
}
```

> **알아두기**: `use cache`는 라우트 핸들러 본문 안에서 직접 사용할 수 없으므로 헬퍼 함수로 분리해야 합니다. 캐시된 응답은 새 요청이 들어올 때 `cacheLife` 설정에 따라 재검증됩니다.

## 특수 라우트 핸들러

[`sitemap.ts`](/docs/app/api-reference/file-conventions/metadata/sitemap), [`opengraph-image.tsx`](/docs/app/api-reference/file-conventions/metadata/opengraph-image), [`icon.tsx`](/docs/app/api-reference/file-conventions/metadata/app-icons) 같은 특수 라우트 핸들러와 그 밖의 [메타데이터 파일](/docs/app/api-reference/file-conventions/metadata)은, 요청 시점 API나 동적 설정 옵션을 사용하지 않는 한 기본적으로 정적으로 유지됩니다.

## 라우트 해석

`route`는 가장 낮은 레벨의 라우팅 원시 요소라고 볼 수 있습니다.

- `page`와 달리 레이아웃이나 클라이언트 사이드 내비게이션에 **참여하지 않습니다**.
- `page.js`와 같은 라우트에 `route.js` 파일을 둘 수 **없습니다**.

| 페이지               | 라우트             | 결과           |
| -------------------- | ------------------ | -------------- |
| `app/page.js`        | `app/route.js`     | ❌ 충돌        |
| `app/page.js`        | `app/api/route.js` | ✅ 유효        |
| `app/[user]/page.js` | `app/api/route.js` | ✅ 유효        |

각 `route.js` 또는 `page.js` 파일이 해당 라우트의 모든 HTTP 메서드를 넘겨받습니다.

```ts filename="app/page.ts" switcher
export default function Page() {
  return <h1>Hello, Next.js!</h1>
}

// 충돌
// `app/route.ts`
export async function POST(request: Request) {}
```

라우트 핸들러가 [프런트엔드 애플리케이션을 어떻게 보완하는지](/docs/app/guides/backend-for-frontend) 더 읽어보거나, 라우트 핸들러 [API 레퍼런스](/docs/app/api-reference/file-conventions/route)를 살펴보세요.

## 라우트 컨텍스트 헬퍼

TypeScript에서는 전역으로 제공되는 [`RouteContext`](/docs/app/api-reference/file-conventions/route#route-context-helper) 헬퍼로 라우트 핸들러의 `context` 파라미터에 타입을 지정할 수 있습니다.

```ts filename="app/users/[id]/route.ts" switcher
import type { NextRequest } from 'next/server'

export async function GET(_req: NextRequest, ctx: RouteContext<'/users/[id]'>) {
  const { id } = await ctx.params
  return Response.json({ id })
}
```

> **알아두기**
>
> - 타입은 `next dev`, `next build`, 또는 `next typegen` 실행 중에 생성됩니다.
