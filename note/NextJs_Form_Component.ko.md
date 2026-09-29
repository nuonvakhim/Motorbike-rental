# Form 컴포넌트

`<Form>` 컴포넌트는 HTML `<form>` 요소를 확장하여 [loading UI](/docs/app/api-reference/file-conventions/loading)의 [**프리페치**](/docs/app/getting-started/linking-and-navigating#prefetching), 제출 시 **클라이언트 측 내비게이션**, 그리고 **점진적 향상(progressive enhancement)** 을 제공합니다.

URL 검색 파라미터를 갱신하는 폼에서 특히 유용한데, 위 기능들을 구현하는 데 필요한 보일러플레이트 코드를 줄여 주기 때문입니다.

기본 사용법:

```tsx filename="/app/ui/search.tsx" switcher
import Form from 'next/form'

export default function Page() {
  return (
    <Form action="/search">
      {/* 제출하면 입력값이 URL에 덧붙여집니다.
          예: /search?query=abc */}
      <input name="query" />
      <button type="submit">Submit</button>
    </Form>
  )
}
```

## 레퍼런스

`<Form>` 컴포넌트의 동작은 `action` prop에 `string`을 넘겼는지 `function`을 넘겼는지에 따라 달라집니다.

- `action`이 **문자열**이면 `<Form>`은 **`GET`** 메서드를 사용하는 네이티브 HTML 폼처럼 동작합니다. 폼 데이터는 검색 파라미터로 URL에 인코딩되고, 폼을 제출하면 지정한 URL로 이동합니다. 여기에 더해 Next.js는 다음을 수행합니다.
  - 폼이 화면에 보이면 해당 경로를 [프리페치](/docs/app/getting-started/linking-and-navigating#prefetching)합니다. 공유 UI(예: `layout.js`, `loading.js`)를 미리 로드하므로 내비게이션이 더 빨라집니다.
  - 폼을 제출할 때 전체 페이지를 새로고침하는 대신 [클라이언트 측 내비게이션](/docs/app/getting-started/linking-and-navigating#client-side-transitions)을 수행합니다. 덕분에 공유 UI와 클라이언트 측 상태가 유지됩니다.
- `action`이 **함수**(서버 액션)이면 `<Form>`은 [React 폼](https://react.dev/reference/react-dom/components/form)처럼 동작하여, 폼이 제출될 때 해당 액션을 실행합니다.

### `action` (문자열) Props

`action`이 문자열일 때 `<Form>` 컴포넌트는 다음 props를 지원합니다.

| Prop       | 예시               | 타입                            | 필수 |
| ---------- | ------------------ | ------------------------------- | ---- |
| `action`   | `action="/search"` | `string` (URL 또는 상대 경로)   | 예   |
| `replace`  | `replace={false}`  | `boolean`                       | -    |
| `scroll`   | `scroll={true}`    | `boolean`                       | -    |
| `prefetch` | `prefetch={false}` | `false \| null`                 | -    |

- **`action`**: 폼을 제출했을 때 이동할 URL 또는 경로입니다.
  - 빈 문자열 `""`을 넘기면 검색 파라미터만 갱신한 채 같은 라우트로 이동합니다.
- **`replace`**: [브라우저 히스토리](https://developer.mozilla.org/en-US/docs/Web/API/History_API) 스택에 새 항목을 추가하는 대신 현재 히스토리 상태를 대체합니다. 기본값은 `false`입니다.
- **`scroll`**: 내비게이션 중 스크롤 동작을 제어합니다. 기본값은 `true`이며, 새 라우트의 맨 위로 스크롤하고 뒤로 가기·앞으로 가기 시에는 스크롤 위치를 유지합니다.
- **`prefetch`**: 폼이 사용자 뷰포트에 보일 때 해당 경로를 프리페치할지 제어합니다. 프리페치는 기본적으로 켜져 있으며, 끄려면 `prefetch={false}`(또는 `null`)를 넘기세요. 프리페치는 프로덕션에서만 동작합니다.
  - 번들된 마크다운 문서에는 여전히 `prefetch={true}` / `boolean`로 적혀 있지만, `next@16.3.4`에서 실제 타입은 `prefetch?: false | null`이며 `true`를 넘기면 `The \`prefetch\` prop of <Form> must be \`false\` or \`null\`` 오류가 출력됩니다. `node_modules/next/dist/client/form-shared.d.ts`와 `dist/esm/client/app-dir/form.js`에서 확인했습니다.

### `action` (함수) Props

`action`이 함수일 때 `<Form>` 컴포넌트는 다음 prop을 지원합니다.

| Prop     | 예시                | 타입                     | 필수 |
| -------- | ------------------- | ------------------------ | ---- |
| `action` | `action={myAction}` | `function` (서버 액션)   | 예   |

- **`action`**: 폼이 제출될 때 호출할 서버 액션입니다. 자세한 내용은 [React 문서](https://react.dev/reference/react-dom/components/form#props)를 참고하세요.

> **알아두기**: `action`이 함수이면 `replace`와 `scroll` props는 무시됩니다.

### 주의사항

- **`formAction`**: `<button>`이나 `<input type="submit">` 필드에서 `action` prop을 덮어쓰는 데 사용할 수 있습니다. 이 경우에도 Next.js는 클라이언트 측 내비게이션을 수행하지만, 프리페치는 지원되지 않습니다.
  - [`basePath`](/docs/app/api-reference/config/next-config-js/basePath)를 사용할 때는 `formAction` 경로에도 이를 포함해야 합니다. 예: `formAction="/base-path/search"`.
- **`key`**: 문자열 `action`에 `key` prop을 넘기는 것은 지원되지 않습니다. 리렌더링을 트리거하거나 데이터를 변경하고 싶다면 함수 `action`을 사용하는 편이 좋습니다.
- **`onSubmit`**: 폼 제출 로직을 처리하는 데 사용할 수 있습니다. 다만 `event.preventDefault()`를 호출하면 지정한 URL로 이동하는 등의 `<Form>` 동작이 무효화됩니다.
- **[`method`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/form#method), [`encType`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/form#enctype), [`target`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/form#target)**: `<Form>` 동작을 덮어쓰기 때문에 지원되지 않습니다.
  - 마찬가지로 `formMethod`, `formEncType`, `formTarget`으로 각각 `method`, `encType`, `target`을 덮어쓸 수 있는데, 이들을 사용하면 네이티브 브라우저 동작으로 되돌아갑니다.
  - 이 props가 꼭 필요하다면 HTML `<form>` 요소를 사용하세요.
- **`<input type="file">`**: `action`이 문자열일 때 이 입력 타입을 사용하면 브라우저 동작에 맞춰 파일 객체가 아니라 파일 이름이 제출됩니다.

## 예시

### 검색 결과 페이지로 이동하는 검색 폼

경로를 `action`으로 넘기면 검색 결과 페이지로 이동하는 검색 폼을 만들 수 있습니다.

```tsx filename="/app/page.tsx" switcher
import Form from 'next/form'

export default function Page() {
  return (
    <Form action="/search">
      <input name="query" />
      <button type="submit">Submit</button>
    </Form>
  )
}
```

사용자가 query 입력 필드를 수정하고 폼을 제출하면, 폼 데이터가 검색 파라미터로 URL에 인코딩됩니다. 예: `/search?query=abc`.

> **알아두기**: `action`에 빈 문자열 `""`을 넘기면 검색 파라미터만 갱신한 채 같은 라우트로 이동합니다.

결과 페이지에서는 [`searchParams`](/docs/app/api-reference/file-conventions/page#searchparams-optional) `page.js` prop으로 query에 접근해 외부 소스에서 데이터를 가져올 수 있습니다.

```tsx filename="/app/search/page.tsx" switcher
import { getSearchResults } from '@/lib/search'

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const results = await getSearchResults((await searchParams).query)

  return <div>...</div>
}
```

`<Form>`이 사용자 뷰포트에 들어오면 `/search` 페이지의 공유 UI(`layout.js`, `loading.js` 등)가 프리페치됩니다. 제출하면 폼은 즉시 새 라우트로 이동하고, 결과를 가져오는 동안 로딩 UI를 보여 줍니다. 폴백 UI는 [`loading.js`](/docs/app/api-reference/file-conventions/loading)로 설계할 수 있습니다.

```tsx filename="/app/search/loading.tsx" switcher
export default function Loading() {
  return <div>Loading...</div>
}
```

공유 UI가 아직 로드되지 않은 경우까지 대비하려면 [`useFormStatus`](https://react.dev/reference/react-dom/hooks/useFormStatus)로 사용자에게 즉각적인 피드백을 보여 줄 수 있습니다.

먼저 폼이 대기 중일 때 로딩 상태를 표시하는 컴포넌트를 만듭니다.

```tsx filename="/app/ui/search-button.tsx" switcher
'use client'
import { useFormStatus } from 'react-dom'

export default function SearchButton() {
  const status = useFormStatus()
  return (
    <button type="submit">{status.pending ? 'Searching...' : 'Search'}</button>
  )
}
```

그런 다음 검색 폼 페이지에서 `SearchButton` 컴포넌트를 사용하도록 수정합니다.

```tsx filename="/app/page.tsx" switcher
import Form from 'next/form'
import { SearchButton } from '@/ui/search-button'

export default function Page() {
  return (
    <Form action="/search">
      <input name="query" />
      <SearchButton />
    </Form>
  )
}
```

### 서버 액션으로 데이터 변경하기

`action` prop에 함수를 넘기면 데이터 변경(mutation)을 수행할 수 있습니다.

```tsx filename="/app/posts/create/page.tsx" switcher
import Form from 'next/form'
import { createPost } from '@/posts/actions'

export default function Page() {
  return (
    <Form action={createPost}>
      <input name="title" />
      {/* ... */}
      <button type="submit">Create Post</button>
    </Form>
  )
}
```

데이터를 변경한 뒤에는 새로 만들어진 리소스로 리다이렉트하는 경우가 많습니다. `next/navigation`의 [`redirect`](/docs/app/guides/redirecting) 함수로 새 글 페이지로 이동할 수 있습니다.

> **알아두기**: 폼 제출의 "목적지"는 액션이 실행되기 전까지 알 수 없으므로, `<Form>`은 공유 UI를 자동으로 프리페치할 수 없습니다.

```tsx filename="/app/posts/actions.ts" switcher
'use server'
import { redirect } from 'next/navigation'

export async function createPost(formData: FormData) {
  // 새 글을 만듭니다
  // ...

  // 새 글로 리다이렉트합니다
  redirect(`/posts/${data.id}`)
}
```

그 다음 새 페이지에서는 `params` prop으로 데이터를 가져올 수 있습니다.

```tsx filename="/app/posts/[id]/page.tsx" switcher
import { getPost } from '@/posts/data'

export default async function PostPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const data = await getPost(id)

  return (
    <div>
      <h1>{data.title}</h1>
      {/* ... */}
    </div>
  )
}
```

더 많은 예시는 [데이터 변경](/docs/app/getting-started/mutating-data)을 참고하세요.

## 관련 문서

- [서버 액션으로 폼 만들기](./NextJs_Forms.ko.md) — 검증, `useActionState`, 대기 상태, 낙관적 업데이트.
