# 서버 액션으로 폼 만들기

React 서버 액션은 서버에서 실행되는 [서버 함수](https://react.dev/reference/rsc/server-functions)입니다. 서버 컴포넌트와 클라이언트 컴포넌트 모두에서 호출해 폼 제출을 처리할 수 있습니다. 이 가이드는 Next.js에서 서버 액션으로 폼을 만드는 방법을 안내합니다. 폼 외의 서버 액션 동작(단일 왕복 응답, 순차 디스패치, 보안, 배포)은 [서버 액션과 데이터 변경](/docs/app/guides/server-actions)을 참고하세요.

> [!WARNING]
> 폼이 인증된 페이지에서만 렌더링되더라도, 각 서버 액션 안에서 항상 [인증과 인가](/docs/app/guides/authentication)를 검증하세요. 자세한 내용은 [데이터 보안 가이드](/docs/app/guides/data-security)를 참고하세요.

## 동작 방식

React는 HTML [`<form>`](https://developer.mozilla.org/docs/Web/HTML/Element/form) 요소를 확장하여 [`action`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/form#action) 속성으로 서버 액션을 호출할 수 있게 합니다.

폼에서 사용하면 해당 함수는 [`FormData`](https://developer.mozilla.org/docs/Web/API/FormData/FormData) 객체를 자동으로 전달받습니다. 그 다음 네이티브 [`FormData` 메서드](https://developer.mozilla.org/en-US/docs/Web/API/FormData#instance_methods)로 데이터를 꺼낼 수 있습니다.

```tsx filename="app/invoices/page.tsx" switcher
import { auth } from '@/lib/auth'

export default function Page() {
  async function createInvoice(formData: FormData) {
    'use server'

    const session = await auth()
    if (!session?.user) {
      throw new Error('Unauthorized')
    }

    const rawFormData = {
      customerId: formData.get('customerId'),
      amount: formData.get('amount'),
      status: formData.get('status'),
    }

    // 데이터를 변경합니다
    // 캐시를 재검증합니다
  }

  return <form action={createInvoice}>...</form>
}
```

> **알아두기:** 필드가 여러 개인 폼을 다룰 때는 자바스크립트의 [`Object.fromEntries()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/fromEntries)를 사용하세요. 예를 들면 `const rawFormData = Object.fromEntries(formData)`처럼 씁니다. 다만 이 객체에는 `$ACTION_` 접두사가 붙은 추가 프로퍼티가 포함된다는 점에 유의하세요.

## 추가 인자 전달하기

폼 필드 외의 값을 서버 함수에 전달하려면 자바스크립트의 [`bind`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/bind) 메서드를 사용하세요. 예를 들어 `updateUser` 서버 함수에 `userId` 인자를 전달하려면 다음과 같이 합니다.

```tsx filename="app/client-component.tsx" highlight={6} switcher
'use client'

import { updateUser } from './actions'

export function UserProfile({ userId }: { userId: string }) {
  const updateUserWithId = updateUser.bind(null, userId)

  return (
    <form action={updateUserWithId}>
      <input type="text" name="name" />
      <button type="submit">Update User Name</button>
    </form>
  )
}
```

서버 함수는 `userId`를 추가 인자로 전달받습니다.

```ts filename="app/actions.ts" switcher
'use server'

export async function updateUser(userId: string, formData: FormData) {}
```

> **알아두기**:
>
> - 대안으로 폼에 숨겨진 입력 필드로 인자를 전달할 수도 있습니다(예: `<input type="hidden" name="userId" value={userId} />`). 다만 이 값은 렌더링된 HTML에 그대로 포함되며 암호화되지 않습니다.
> - `bind`는 서버 컴포넌트와 클라이언트 컴포넌트 양쪽에서 동작하며 점진적 향상(progressive enhancement)을 지원합니다.

## 폼 검증

폼은 클라이언트 또는 서버에서 검증할 수 있습니다.

- **클라이언트 측 검증**에는 `required`, `type="email"` 같은 HTML 속성을 사용해 기본적인 검증을 할 수 있습니다.
- **서버 측 검증**에는 [Zod](https://zod.dev/)나 [Valibot](https://valibot.dev/) 같은 스키마 검증 라이브러리로 폼 필드를 검증할 수 있습니다. 예시는 다음과 같습니다.

```tsx filename="app/actions.ts" switcher
'use server'

import { z } from 'zod'

const schema = z.object({
  email: z.string({
    invalid_type_error: 'Invalid Email',
  }),
})

export default async function createUser(formData: FormData) {
  const validatedFields = schema.safeParse({
    email: formData.get('email'),
  })

  // 폼 데이터가 유효하지 않으면 일찍 반환합니다
  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
    }
  }

  // 데이터를 변경합니다
}
```

## 검증 오류 표시하기

검증 오류나 메시지를 표시하려면 `<form>`을 정의한 컴포넌트를 클라이언트 컴포넌트로 바꾸고 React의 [`useActionState`](https://react.dev/reference/react/useActionState)를 사용하세요.

`useActionState`를 사용하면 서버 함수의 시그니처가 바뀌어, 첫 번째 인자로 `prevState` 또는 `initialState` 매개변수를 받게 됩니다.

```tsx filename="app/actions.ts" highlight={5} switcher
'use server'

import { z } from 'zod'

export async function createUser(initialState: any, formData: FormData) {
  const validatedFields = schema.safeParse({
    email: formData.get('email'),
  })
  // ...
}
```

그 다음 `state` 객체를 기준으로 오류 메시지를 조건부로 렌더링할 수 있습니다.

```tsx filename="app/ui/signup.tsx" highlight={11,18-20} switcher
'use client'

import { useActionState } from 'react'
import { createUser } from '@/app/actions'

const initialState = {
  message: '',
}

export function Signup() {
  const [state, formAction, pending] = useActionState(createUser, initialState)

  return (
    <form action={formAction}>
      <label htmlFor="email">Email</label>
      <input type="text" id="email" name="email" required />
      {/* ... */}
      <p aria-live="polite">{state?.message}</p>
      <button disabled={pending}>Sign up</button>
    </form>
  )
}
```

## 대기 상태

[`useActionState`](https://react.dev/reference/react/useActionState) 훅은 `pending` 불리언 값을 제공하며, 액션이 실행되는 동안 로딩 표시를 보여주거나 제출 버튼을 비활성화하는 데 사용할 수 있습니다.

```tsx filename="app/ui/signup.tsx" highlight={7,12} switcher
'use client'

import { useActionState } from 'react'
import { createUser } from '@/app/actions'

export function Signup() {
  const [state, formAction, pending] = useActionState(createUser, initialState)

  return (
    <form action={formAction}>
      {/* 그 밖의 폼 요소들 */}
      <button disabled={pending}>Sign up</button>
    </form>
  )
}
```

또는 [`useFormStatus`](https://react.dev/reference/react-dom/hooks/useFormStatus) 훅으로 액션이 실행되는 동안 로딩 표시를 보여줄 수도 있습니다. 이 훅을 사용할 때는 로딩 표시를 렌더링할 별도의 컴포넌트를 만들어야 합니다. 예를 들어 액션이 대기 중일 때 버튼을 비활성화하려면 다음과 같이 합니다.

```tsx filename="app/ui/button.tsx" highlight={6} switcher
'use client'

import { useFormStatus } from 'react-dom'

export function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <button disabled={pending} type="submit">
      Sign Up
    </button>
  )
}
```

그런 다음 `SubmitButton` 컴포넌트를 폼 안에 중첩합니다.

```tsx filename="app/ui/signup.tsx" switcher
import { SubmitButton } from './button'
import { createUser } from '@/app/actions'

export function Signup() {
  return (
    <form action={createUser}>
      {/* 그 밖의 폼 요소들 */}
      <SubmitButton />
    </form>
  )
}
```

> **알아두기:** React 19에서는 `useFormStatus`가 반환하는 객체에 data, method, action 같은 키가 추가로 포함됩니다. React 19를 사용하지 않는다면 `pending` 키만 사용할 수 있습니다.

> **알아두기**: **실험적** [`useOffline`](/docs/app/guides/offline-support) 설정을 활성화하면, 네트워크 연결이 끊겨 중단된 서버 액션이 대기 상태로 남아 있다가 네트워크가 복구되면 완료되므로 사용자가 제출한 내용을 잃지 않습니다.

## 낙관적 업데이트

React의 [`useOptimistic`](https://react.dev/reference/react/useOptimistic) 훅을 사용하면 서버 함수의 실행이 끝나기를 기다리지 않고, 그 전에 UI를 낙관적으로 먼저 업데이트할 수 있습니다.

```tsx filename="app/page.tsx" switcher
'use client'

import { useOptimistic } from 'react'
import { send } from './actions'

type Message = {
  message: string
}

export function Thread({ messages }: { messages: Message[] }) {
  const [optimisticMessages, addOptimisticMessage] = useOptimistic<
    Message[],
    string
  >(messages, (state, newMessage) => [...state, { message: newMessage }])

  const formAction = async (formData: FormData) => {
    const message = formData.get('message') as string
    addOptimisticMessage(message)
    await send(message)
  }

  return (
    <div>
      {optimisticMessages.map((m, i) => (
        <div key={i}>{m.message}</div>
      ))}
      <form action={formAction}>
        <input type="text" name="message" />
        <button type="submit">Send</button>
      </form>
    </div>
  )
}
```

## 중첩된 폼 요소

`<form>` 안에 중첩된 `<button>`, `<input type="submit">`, `<input type="image">` 같은 요소에서도 서버 액션을 호출할 수 있습니다. 이들 요소는 `formAction` prop이나 이벤트 핸들러를 받습니다.

하나의 폼 안에서 여러 서버 액션을 호출하고 싶을 때 유용합니다. 예를 들어 글을 발행하는 것과 별도로 초안을 저장하는 전용 `<button>` 요소를 만들 수 있습니다. 자세한 내용은 [React `<form>` 문서](https://react.dev/reference/react-dom/components/form#handling-multiple-submission-types)를 참고하세요.

## 프로그래밍 방식으로 폼 제출하기

[`requestSubmit()`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLFormElement/requestSubmit) 메서드로 폼 제출을 프로그래밍 방식으로 트리거할 수 있습니다. 예를 들어 사용자가 `⌘` + `Enter` 단축키로 폼을 제출하도록 하려면 `onKeyDown` 이벤트를 수신하면 됩니다.

```tsx filename="app/entry.tsx" switcher
'use client'

export function Entry() {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      (e.ctrlKey || e.metaKey) &&
      (e.key === 'Enter' || e.key === 'NumpadEnter')
    ) {
      e.preventDefault()
      e.currentTarget.form?.requestSubmit()
    }
  }

  return (
    <div>
      <textarea name="entry" rows={20} required onKeyDown={handleKeyDown} />
    </div>
  )
}
```

이렇게 하면 가장 가까운 `<form>` 조상의 제출이 트리거되고, 그 결과 서버 함수가 호출됩니다.

## 관련 문서

- [Form 컴포넌트](./NextJs_Form_Component.ko.md) — 검색 파라미터를 갱신하며 이동하는 폼을 위한 `next/form` 컴포넌트.
- [서버 액션과 데이터 변경](./NextJs_Server_Actions.ko.md) — 폼 외의 액션 동작: 응답 형태, 디스패치, 보안.
