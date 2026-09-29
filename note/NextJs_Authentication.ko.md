# Next.js에서 인증 구현하기

애플리케이션의 데이터를 보호하려면 인증을 이해하는 것이 매우 중요합니다. 이 문서에서는 인증을 구현할 때 사용할 React와 Next.js 기능을 안내합니다.

시작하기 전에, 전체 과정을 세 가지 개념으로 나눠 보면 이해에 도움이 됩니다.

1. **[인증](#인증)**: 사용자가 자신이 주장하는 사람이 맞는지 확인합니다. 사용자는 아이디와 비밀번호처럼 자신이 가진 무언가로 신원을 증명해야 합니다.
2. **[세션 관리](#세션-관리)**: 여러 요청에 걸쳐 사용자의 인증 상태를 추적합니다.
3. **[인가](#인가)**: 사용자가 어떤 라우트와 데이터에 접근할 수 있는지 결정합니다.

아래 다이어그램은 React와 Next.js 기능을 사용한 인증 흐름을 보여줍니다.

![React와 Next.js 기능을 사용한 인증 흐름 다이어그램](https://h8DxKfmAPhn8O0p3.public.blob.vercel-storage.com/docs/light/authentication-overview-new.png)

이 문서의 예시는 학습을 위해 기본적인 아이디·비밀번호 인증을 단계별로 살펴봅니다. 인증을 직접 구현할 수도 있지만, 보안과 편의를 위해 인증 라이브러리 사용을 권장합니다. 인증 라이브러리는 인증, 세션 관리, 인가에 대한 기본 구현은 물론 소셜 로그인, 다중 인증(MFA), 역할 기반 접근 제어 같은 추가 기능도 제공합니다. 목록은 [인증 라이브러리](#auth-libraries) 절에서 확인할 수 있습니다.

> **알아두기:** [Cache Components](/docs/app/api-reference/config/next-config-js/cacheComponents)를 활성화하면 세션을 읽고 사용자별 데이터를 캐시하는 데 별도의 규칙이 적용됩니다. [Cache Components와 인증](/docs/app/guides/authentication-with-cache-components)을 참고하세요.

## 인증

### 회원가입과 로그인 기능

[`<form>`](https://react.dev/reference/react-dom/components/form) 요소를 React의 [서버 액션](/docs/app/getting-started/mutating-data), `useActionState`와 함께 사용하면 사용자 자격 증명을 수집하고, 폼 필드를 검증하고, 인증 제공자의 API나 데이터베이스를 호출할 수 있습니다.

서버 액션은 항상 서버에서 실행되므로 인증 로직을 다루기에 안전한 환경을 제공합니다.

회원가입/로그인 기능을 구현하는 단계는 다음과 같습니다.

#### 1. 사용자 자격 증명 수집하기

사용자 자격 증명을 수집하려면 제출 시 서버 액션을 호출하는 폼을 만듭니다. 예를 들어 이름, 이메일, 비밀번호를 받는 회원가입 폼은 다음과 같습니다.

```tsx filename="app/ui/signup-form.tsx" switcher
import { signup } from "@/app/actions/auth";

export function SignupForm() {
  return (
    <form action={signup}>
      <div>
        <label htmlFor="name">Name</label>
        <input id="name" name="name" placeholder="Name" />
      </div>
      <div>
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" placeholder="Email" />
      </div>
      <div>
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" />
      </div>
      <button type="submit">Sign Up</button>
    </form>
  );
}
```

```tsx filename="app/actions/auth.ts" switcher
export async function signup(formData: FormData) {}
```

#### 2. 서버에서 폼 필드 검증하기

서버 액션에서 폼 필드를 서버 측에서 검증하세요. 사용 중인 인증 제공자가 폼 검증을 제공하지 않는다면 [Zod](https://zod.dev/), [Valibot](https://valibot.dev/), [Yup](https://github.com/jquense/yup) 같은 스키마 검증 라이브러리를 사용할 수 있습니다.

Zod를 예로 들면, 적절한 오류 메시지와 함께 폼 스키마를 정의할 수 있습니다.

```ts filename="app/lib/definitions.ts" switcher
import * as z from "zod";

export const SignupFormSchema = z.object({
  name: z
    .string()
    .min(2, { error: "Name must be at least 2 characters long." })
    .trim(),
  email: z.email({ error: "Please enter a valid email." }).trim(),
  password: z
    .string()
    .min(8, { error: "Be at least 8 characters long" })
    .regex(/[a-zA-Z]/, { error: "Contain at least one letter." })
    .regex(/[0-9]/, { error: "Contain at least one number." })
    .regex(/[^a-zA-Z0-9]/, {
      error: "Contain at least one special character.",
    })
    .trim(),
});

export type FormState =
  | {
      errors?: {
        name?: string[];
        email?: string[];
        password?: string[];
      };
      message?: string;
    }
  | undefined;
```

인증 제공자의 API나 데이터베이스를 불필요하게 호출하지 않으려면, 폼 필드가 정의한 스키마와 맞지 않을 때 서버 액션에서 일찍 `return` 하면 됩니다.

```ts filename="app/actions/auth.ts" switcher
import { SignupFormSchema, FormState } from "@/app/lib/definitions";

export async function signup(state: FormState, formData: FormData) {
  // 폼 필드를 검증합니다
  const validatedFields = SignupFormSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  // 유효하지 않은 필드가 하나라도 있으면 일찍 반환합니다
  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  // 제공자나 DB를 호출해 사용자를 생성합니다...
}
```

다시 `<SignupForm />`으로 돌아와, React의 `useActionState` 훅을 사용하면 폼이 제출되는 동안 검증 오류를 표시할 수 있습니다.

```tsx filename="app/ui/signup-form.tsx" switcher highlight={7,15,21,27-36}
"use client";

import { signup } from "@/app/actions/auth";
import { useActionState } from "react";

export default function SignupForm() {
  const [state, action, pending] = useActionState(signup, undefined);

  return (
    <form action={action}>
      <div>
        <label htmlFor="name">Name</label>
        <input id="name" name="name" placeholder="Name" />
      </div>
      {state?.errors?.name && <p>{state.errors.name}</p>}

      <div>
        <label htmlFor="email">Email</label>
        <input id="email" name="email" placeholder="Email" />
      </div>
      {state?.errors?.email && <p>{state.errors.email}</p>}

      <div>
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" />
      </div>
      {state?.errors?.password && (
        <div>
          <p>Password must:</p>
          <ul>
            {state.errors.password.map((error) => (
              <li key={error}>- {error}</li>
            ))}
          </ul>
        </div>
      )}
      <button disabled={pending} type="submit">
        Sign Up
      </button>
    </form>
  );
}
```

> **알아두기:**
>
> - React 19에서는 `useFormStatus`가 반환하는 객체에 data, method, action 같은 키가 추가로 포함됩니다. React 19를 사용하지 않는다면 `pending` 키만 사용할 수 있습니다.
> - 데이터를 변경하기 전에는 사용자가 해당 작업을 수행할 권한이 있는지 항상 확인해야 합니다. [인증과 인가](#인가)를 참고하세요.

#### 3. 사용자 생성 또는 자격 증명 확인하기

폼 필드를 검증한 뒤에는 인증 제공자의 API나 데이터베이스를 호출해 새 사용자 계정을 만들거나 해당 사용자가 존재하는지 확인할 수 있습니다.

앞선 예시에서 이어집니다.

```tsx filename="app/actions/auth.tsx" switcher
export async function signup(state: FormState, formData: FormData) {
  // 1. 폼 필드를 검증합니다
  // ...

  // 2. 데이터베이스에 넣을 데이터를 준비합니다
  const { name, email, password } = validatedFields.data;
  // 예: 저장하기 전에 사용자의 비밀번호를 해싱합니다
  const hashedPassword = await bcrypt.hash(password, 10);

  // 3. 사용자를 데이터베이스에 삽입하거나 인증 라이브러리의 API를 호출합니다
  const data = await db
    .insert(users)
    .values({
      name,
      email,
      password: hashedPassword,
    })
    .returning({ id: users.id });

  const user = data[0];

  if (!user) {
    return {
      message: "An error occurred while creating your account.",
    };
  }

  // TODO:
  // 4. 사용자 세션을 생성합니다
  // 5. 사용자를 리다이렉트합니다
}
```

사용자 계정을 성공적으로 만들었거나 자격 증명을 확인했다면, 세션을 생성해 사용자의 인증 상태를 관리할 수 있습니다. 세션 관리 전략에 따라 세션은 쿠키나 데이터베이스, 또는 둘 모두에 저장할 수 있습니다. 자세한 내용은 [세션 관리](#세션-관리) 절에서 이어집니다.

> **팁:**
>
> - 위 예시는 학습을 위해 인증 단계를 하나하나 나눠 보여주다 보니 다소 장황합니다. 그만큼 안전한 인증을 직접 구현하는 일이 금세 복잡해진다는 뜻이기도 합니다. 과정을 단순화하려면 [인증 라이브러리](#auth-libraries) 사용을 고려하세요.
> - 사용자 경험을 개선하려면 가입 흐름의 이른 시점에 이메일이나 아이디 중복을 확인하는 것이 좋습니다. 예를 들어 사용자가 아이디를 입력하는 중이거나 입력 필드에서 포커스가 벗어날 때 확인할 수 있습니다. 이렇게 하면 불필요한 폼 제출을 막고 사용자에게 즉시 피드백을 줄 수 있습니다. [use-debounce](https://www.npmjs.com/package/use-debounce) 같은 라이브러리로 요청을 디바운스해 확인 빈도를 조절할 수 있습니다.

## 세션 관리

세션 관리는 여러 요청에 걸쳐 사용자의 인증 상태가 유지되도록 보장합니다. 여기에는 세션이나 토큰을 생성, 저장, 갱신, 삭제하는 일이 포함됩니다.

세션에는 두 가지 유형이 있습니다.

1. [**무상태**](#무상태-세션): 세션 데이터(또는 토큰)를 브라우저 쿠키에 저장합니다. 쿠키는 매 요청마다 함께 전송되므로 서버에서 세션을 검증할 수 있습니다. 이 방식은 더 단순하지만, 제대로 구현하지 않으면 보안이 약해질 수 있습니다.
2. [**데이터베이스**](#데이터베이스-세션): 세션 데이터를 데이터베이스에 저장하고, 사용자의 브라우저에는 암호화된 세션 ID만 전달합니다. 이 방식은 더 안전하지만, 복잡하고 서버 자원을 더 많이 사용할 수 있습니다.

> **알아두기:** 두 방식 중 하나를 쓰거나 둘 다 쓸 수 있지만, [iron-session](https://github.com/vvo/iron-session)이나 [Jose](https://github.com/panva/jose) 같은 세션 관리 라이브러리 사용을 권장합니다.

### 무상태 세션

무상태 세션을 만들고 관리하려면 다음 단계를 따라야 합니다.

1. 세션에 서명할 때 사용할 시크릿 키를 생성하고 [환경 변수](/docs/app/guides/environment-variables)로 저장합니다.
2. 세션 관리 라이브러리로 세션 데이터를 암호화/복호화하는 로직을 작성합니다.
3. Next.js [`cookies`](/docs/app/api-reference/functions/cookies) API로 쿠키를 관리합니다.

여기에 더해, 사용자가 애플리케이션에 다시 접속했을 때 세션을 [갱신(리프레시)](#세션-갱신리프레시하기)하는 기능과 로그아웃 시 세션을 [삭제](#세션-삭제하기)하는 기능도 함께 고려하세요.

> **알아두기:** 사용 중인 [인증 라이브러리](#auth-libraries)에 세션 관리 기능이 포함되어 있는지 확인하세요.

#### 1. 시크릿 키 생성하기

세션에 서명할 시크릿 키는 여러 방법으로 만들 수 있습니다. 예를 들어 터미널에서 `openssl` 명령을 사용할 수 있습니다.

```bash filename="terminal"
openssl rand -base64 32
```

이 명령은 32자 길이의 무작위 문자열을 생성하며, 이를 시크릿 키로 삼아 [환경 변수 파일](/docs/app/guides/environment-variables)에 저장할 수 있습니다.

```bash filename=".env"
SESSION_SECRET=your_secret_key
```

그런 다음 세션 관리 로직에서 이 키를 참조합니다.

```js filename="app/lib/session.js"
const secretKey = process.env.SESSION_SECRET;
```

#### 2. 세션 암호화와 복호화

다음으로, 원하는 [세션 관리 라이브러리](#session-management-libraries)로 세션을 암호화하고 복호화합니다. 앞선 예시에 이어 [Jose](https://www.npmjs.com/package/jose)와 React의 [`server-only`](https://www.npmjs.com/package/server-only) 패키지를 사용해 세션 관리 로직이 서버에서만 실행되도록 하겠습니다.

```tsx filename="app/lib/session.ts" switcher
import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { SessionPayload } from "@/app/lib/definitions";

const secretKey = process.env.SESSION_SECRET;
const encodedKey = new TextEncoder().encode(secretKey);

export async function encrypt(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(encodedKey);
}

export async function decrypt(session: string | undefined = "") {
  try {
    const { payload } = await jwtVerify(session, encodedKey, {
      algorithms: ["HS256"],
    });
    return payload;
  } catch (error) {
    console.log("Failed to verify session");
  }
}
```

> **팁**:
>
> - 페이로드에는 이후 요청에서 사용할 **최소한의** 고유한 사용자 데이터(사용자 ID, 역할 등)만 담아야 합니다. 전화번호, 이메일 주소, 신용카드 정보 같은 개인 식별 정보나 비밀번호 같은 민감한 데이터는 넣지 마세요.

#### 3. 쿠키 설정하기(권장 옵션)

세션을 쿠키에 저장하려면 Next.js [`cookies`](/docs/app/api-reference/functions/cookies) API를 사용하세요. 쿠키는 서버에서 설정해야 하며, 다음 권장 옵션을 포함해야 합니다.

- **HttpOnly**: 클라이언트 측 자바스크립트가 쿠키에 접근하지 못하게 합니다.
- **Secure**: https로 쿠키를 전송합니다.
- **SameSite**: 쿠키를 교차 사이트 요청과 함께 보낼 수 있는지 지정합니다.
- **Max-Age 또는 Expires**: 일정 기간이 지나면 쿠키를 삭제합니다.
- **Path**: 쿠키가 적용될 URL 경로를 정의합니다.

각 옵션에 대한 자세한 내용은 [MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies)을 참고하세요.

```ts filename="app/lib/session.ts" switcher
import "server-only";
import { cookies } from "next/headers";

export async function createSession(userId: string) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const session = await encrypt({ userId, expiresAt });
  const cookieStore = await cookies();

  cookieStore.set("session", session, {
    httpOnly: true,
    secure: true,
    expires: expiresAt,
    sameSite: "lax",
    path: "/",
  });
}
```

다시 서버 액션으로 돌아가 `createSession()` 함수를 호출하고, [`redirect()`](/docs/app/guides/redirecting) API로 사용자를 적절한 페이지로 이동시킬 수 있습니다.

```ts filename="app/actions/auth.ts" switcher
import { createSession } from "@/app/lib/session";

export async function signup(state: FormState, formData: FormData) {
  // 앞선 단계:
  // 1. 폼 필드를 검증합니다
  // 2. 데이터베이스에 넣을 데이터를 준비합니다
  // 3. 사용자를 데이터베이스에 삽입하거나 라이브러리 API를 호출합니다

  // 현재 단계:
  // 4. 사용자 세션을 생성합니다
  await createSession(user.id);
  // 5. 사용자를 리다이렉트합니다
  redirect("/profile");
}
```

> **팁**:
>
> - **쿠키는 서버에서 설정해야** 클라이언트 측 조작을 막을 수 있습니다.
> - 🎥 영상: Next.js의 무상태 세션과 인증에 대해 더 알아보기 → [YouTube (11분)](https://www.youtube.com/watch?v=DJvM2lSPn6w).

#### 세션 갱신(리프레시)하기

세션의 만료 시간을 연장할 수도 있습니다. 사용자가 애플리케이션에 다시 접속했을 때 로그인 상태를 유지하는 데 유용합니다. 예를 들면 다음과 같습니다.

```ts filename="app/lib/session.ts" switcher
import "server-only";
import { cookies } from "next/headers";
import { decrypt } from "@/app/lib/session";

export async function updateSession() {
  const session = (await cookies()).get("session")?.value;
  const payload = await decrypt(session);

  if (!session || !payload) {
    return null;
  }

  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const cookieStore = await cookies();
  cookieStore.set("session", session, {
    httpOnly: true,
    secure: true,
    expires: expires,
    sameSite: "lax",
    path: "/",
  });
}
```

> **팁:** 사용 중인 인증 라이브러리가 리프레시 토큰을 지원하는지 확인하세요. 리프레시 토큰으로 사용자의 세션을 연장할 수 있습니다.

#### 세션 삭제하기

세션을 삭제하려면 쿠키를 삭제하면 됩니다.

```ts filename="app/lib/session.ts" switcher
import "server-only";
import { cookies } from "next/headers";

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete("session");
}
```

그런 다음 애플리케이션에서 `deleteSession()` 함수를 재사용할 수 있습니다. 예를 들어 로그아웃 시 다음과 같이 사용합니다.

```ts filename="app/actions/auth.ts" switcher
import { cookies } from "next/headers";
import { deleteSession } from "@/app/lib/session";

export async function logout() {
  await deleteSession();
  redirect("/login");
}
```

### 데이터베이스 세션

데이터베이스 세션을 만들고 관리하려면 다음 단계를 따라야 합니다.

1. 세션과 관련 데이터를 저장할 테이블을 데이터베이스에 만듭니다(또는 사용 중인 인증 라이브러리가 이를 처리하는지 확인합니다).
2. 세션을 삽입, 갱신, 삭제하는 기능을 구현합니다.
3. 세션 ID를 암호화한 뒤 사용자의 브라우저에 저장하고, 데이터베이스와 쿠키가 항상 동기화되도록 합니다(선택 사항이지만 [프록시](#프록시를-이용한-낙관적-검사선택)에서의 낙관적 인증 검사를 위해 권장합니다).

예를 들면 다음과 같습니다.

```ts filename="app/lib/session.ts" switcher
import { cookies } from "next/headers";
import { db } from "@/app/lib/db";
import { encrypt } from "@/app/lib/session";

export async function createSession(id: number) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  // 1. 데이터베이스에 세션을 생성합니다
  const data = await db
    .insert(sessions)
    .values({
      userId: id,
      expiresAt,
    })
    // 세션 ID를 반환합니다
    .returning({ id: sessions.id });

  const sessionId = data[0].id;

  // 2. 세션 ID를 암호화합니다
  const session = await encrypt({ sessionId, expiresAt });

  // 3. 낙관적 인증 검사를 위해 세션을 쿠키에 저장합니다
  const cookieStore = await cookies();
  cookieStore.set("session", session, {
    httpOnly: true,
    secure: true,
    expires: expiresAt,
    sameSite: "lax",
    path: "/",
  });
}
```

> **팁**:
>
> - 더 빠르게 접근하려면 세션이 유지되는 동안 서버 캐싱을 추가하는 것도 고려해 보세요. 세션 데이터를 주 데이터베이스에 함께 두고 데이터 요청을 합쳐 쿼리 수를 줄일 수도 있습니다.
> - 사용자가 마지막으로 로그인한 시각이나 활성 기기 수를 추적하거나, 모든 기기에서 로그아웃하는 기능을 제공하는 등 더 고급 사용 사례에는 데이터베이스 세션을 선택할 수 있습니다.

세션 관리를 구현한 다음에는, 사용자가 무엇에 접근하고 무엇을 할 수 있는지 제어하는 인가 로직을 추가해야 합니다. 자세한 내용은 [인가](#인가) 절에서 이어집니다.

## 인가

사용자가 인증되고 세션이 생성되면, 인가를 구현해 사용자가 애플리케이션 안에서 무엇에 접근하고 무엇을 할 수 있는지 제어할 수 있습니다.

인가 검사에는 크게 두 가지 유형이 있습니다.

1. **낙관적(Optimistic)**: 쿠키에 저장된 세션 데이터를 사용해 사용자가 라우트에 접근하거나 작업을 수행할 권한이 있는지 확인합니다. UI 요소를 보이거나 숨기고, 권한이나 역할에 따라 사용자를 리다이렉트하는 등 빠른 처리가 필요한 경우에 유용합니다.
2. **안전한(Secure)**: 데이터베이스에 저장된 세션 데이터를 사용해 사용자가 라우트에 접근하거나 작업을 수행할 권한이 있는지 확인합니다. 더 안전하며, 민감한 데이터나 작업에 접근할 때 사용합니다.

두 경우 모두 다음을 권장합니다.

- 인가 로직을 한곳에 모으는 [데이터 접근 계층(DAL)](#데이터-접근-계층dal-만들기) 만들기
- 필요한 데이터만 반환하도록 [데이터 전송 객체(DTO)](#데이터-전송-객체dto-사용하기) 사용하기
- 필요하다면 [프록시](#프록시를-이용한-낙관적-검사선택)로 낙관적 검사 수행하기

### 프록시를 이용한 낙관적 검사(선택)

[프록시](/docs/app/api-reference/file-conventions/proxy)를 사용해 권한에 따라 사용자를 리다이렉트하고 싶은 경우가 있습니다.

- 낙관적 검사를 수행할 때. 프록시는 모든 라우트에서 실행되므로 리다이렉트 로직을 한곳에 모으고 권한 없는 사용자를 미리 걸러내기에 좋습니다.
- 사용자 간에 데이터를 공유하는 정적 라우트를 보호할 때(예: 유료 구독 뒤에 있는 콘텐츠).

다만 프록시는 [프리페치](/docs/app/getting-started/linking-and-navigating#prefetching)되는 라우트를 포함해 모든 라우트에서 실행되므로, 성능 문제를 피하려면 쿠키에서 세션을 읽는 것(낙관적 검사)만 하고 데이터베이스 조회는 피하는 것이 중요합니다.

예를 들면 다음과 같습니다.

```tsx filename="proxy.ts" switcher
import { NextRequest, NextResponse } from "next/server";
import { decrypt } from "@/app/lib/session";
import { cookies } from "next/headers";

// 1. 보호할 라우트와 공개 라우트를 지정합니다
const protectedRoutes = ["/dashboard"];
const publicRoutes = ["/login", "/signup", "/"];

export default async function proxy(req: NextRequest) {
  // 2. 현재 라우트가 보호 대상인지 공개 대상인지 확인합니다
  const path = req.nextUrl.pathname;
  const isProtectedRoute = protectedRoutes.includes(path);
  const isPublicRoute = publicRoutes.includes(path);

  // 3. 쿠키에서 세션을 복호화합니다
  const cookie = (await cookies()).get("session")?.value;
  const session = await decrypt(cookie);

  // 4. 인증되지 않은 사용자는 /login으로 리다이렉트합니다
  if (isProtectedRoute && !session?.userId) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  // 5. 인증된 사용자는 /dashboard로 리다이렉트합니다
  if (
    isPublicRoute &&
    session?.userId &&
    !req.nextUrl.pathname.startsWith("/dashboard")
  ) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }

  return NextResponse.next();
}

// 프록시를 실행하지 않을 라우트
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\.png$).*)"],
};
```

프록시는 1차 검사에 유용하지만, 데이터를 보호하는 유일한 방어선이 되어서는 안 됩니다. 보안 검사는 대부분 데이터 소스와 최대한 가까운 곳에서 수행해야 합니다. 자세한 내용은 [데이터 접근 계층(DAL)](#데이터-접근-계층dal-만들기)을 참고하세요.

> **팁**:
>
> - 프록시에서는 `req.cookies.get('session')?.value`로도 쿠키를 읽을 수 있습니다.
> - 프록시는 Node.js 런타임을 사용하므로, 사용 중인 인증 라이브러리와 세션 관리 라이브러리가 호환되는지 확인하세요.
> - 프록시의 `matcher` 속성으로 프록시를 실행할 라우트를 지정할 수 있습니다. 다만 인증 목적이라면 모든 라우트에서 프록시를 실행하는 것을 권장합니다.

### 데이터 접근 계층(DAL) 만들기

데이터 요청과 인가 로직을 한곳에 모으는 DAL을 만드는 것을 권장합니다.

DAL에는 사용자가 애플리케이션과 상호작용할 때 세션을 검증하는 함수가 포함되어야 합니다. 최소한 이 함수는 세션이 유효한지 확인한 뒤, 리다이렉트하거나 이후 요청에 필요한 사용자 정보를 반환해야 합니다.

예를 들어 `verifySession()` 함수를 담은 DAL 파일을 따로 만듭니다. 그런 다음 React의 [cache](https://react.dev/reference/react/cache) API로 React 렌더 과정 동안 함수의 반환값을 메모이제이션합니다.

```tsx filename="app/lib/dal.ts" switcher
import "server-only";

import { cookies } from "next/headers";
import { decrypt } from "@/app/lib/session";

export const verifySession = cache(async () => {
  const cookie = (await cookies()).get("session")?.value;
  const session = await decrypt(cookie);

  if (!session?.userId) {
    redirect("/login");
  }

  return { isAuth: true, userId: session.userId };
});
```

그러면 데이터 요청, 서버 액션, 라우트 핸들러에서 `verifySession()` 함수를 호출할 수 있습니다.

```tsx filename="app/lib/dal.ts" switcher
export const getUser = cache(async () => {
  const session = await verifySession();
  if (!session) return null;

  try {
    const data = await db.query.users.findMany({
      where: eq(users.id, session.userId),
      // 사용자 객체 전체가 아니라 필요한 컬럼만 명시적으로 반환합니다
      columns: {
        id: true,
        name: true,
        email: true,
      },
    });

    const user = data[0];

    return user;
  } catch (error) {
    console.log("Failed to fetch user");
    return null;
  }
});
```

> **팁**:
>
> - DAL은 요청 시점에 가져오는 데이터를 보호하는 데 사용할 수 있습니다. 다만 사용자 간에 데이터를 공유하는 정적 라우트에서는 데이터가 요청 시점이 아니라 빌드 시점에 가져와집니다. 정적 라우트를 보호하려면 [프록시](#프록시를-이용한-낙관적-검사선택)를 사용하세요.
> - 안전한 검사를 위해서는 세션 ID를 데이터베이스와 대조해 세션이 유효한지 확인할 수 있습니다. 렌더 과정 중 데이터베이스에 불필요한 중복 요청이 가지 않도록 React의 [cache](https://react.dev/reference/react/cache) 함수를 사용하세요.
> - 관련된 데이터 요청들을 하나의 자바스크립트 클래스로 모으고, 모든 메서드보다 먼저 `verifySession()`을 실행하도록 구성할 수도 있습니다.

### 데이터 전송 객체(DTO) 사용하기

데이터를 가져올 때는 객체 전체가 아니라 애플리케이션에서 실제로 사용할 데이터만 반환하는 것이 좋습니다. 예를 들어 사용자 데이터를 가져온다면, 비밀번호나 전화번호까지 포함된 사용자 객체 전체가 아니라 사용자 ID와 이름만 반환할 수 있습니다.

하지만 반환되는 데이터 구조를 직접 제어할 수 없거나, 팀 작업에서 객체 전체가 클라이언트로 전달되는 것을 막고 싶다면, 클라이언트에 노출해도 안전한 필드를 명시하는 방식 등을 사용할 수 있습니다.

```tsx filename="app/lib/dto.ts" switcher
import "server-only";
import { getUser } from "@/app/lib/dal";

function canSeeUsername(viewer: User) {
  return true;
}

function canSeePhoneNumber(viewer: User, team: string) {
  return viewer.isAdmin || team === viewer.team;
}

export async function getProfileDTO(slug: string) {
  const data = await db.query.users.findMany({
    where: eq(users.slug, slug),
    // 여기에서 특정 컬럼만 반환합니다
  });
  const user = data[0];

  const currentUser = await getUser(user.id);

  // 또는 여기에서 해당 쿼리에 필요한 값만 반환합니다
  return {
    username: canSeeUsername(currentUser) ? user.username : null,
    phonenumber: canSeePhoneNumber(currentUser, user.team)
      ? user.phonenumber
      : null,
  };
}
```

데이터 요청과 인가 로직을 DAL에 모으고 DTO를 사용하면 모든 데이터 요청이 안전하고 일관되게 처리되며, 애플리케이션이 커져도 유지보수, 감사, 디버깅이 쉬워집니다.

> **알아두기**:
>
> - DTO를 정의하는 방법은 `toJSON()`을 쓰는 방식, 위 예시처럼 개별 함수를 쓰는 방식, JS 클래스를 쓰는 방식 등 여러 가지가 있습니다. 이는 React나 Next.js의 기능이 아니라 자바스크립트 패턴이므로, 애플리케이션에 가장 맞는 패턴을 찾아보시길 권합니다.
> - 보안 모범 사례는 [Next.js의 보안](/blog/security-nextjs-server-components-actions) 글에서 더 알아볼 수 있습니다.

### 서버 컴포넌트

[서버 컴포넌트](/docs/app/getting-started/server-and-client-components)에서의 인증 검사는 역할 기반 접근 제어에 유용합니다. 예를 들어 사용자의 역할에 따라 컴포넌트를 조건부로 렌더링할 수 있습니다.

```tsx filename="app/dashboard/page.tsx" switcher
import { verifySession } from "@/app/lib/dal";

export default async function Dashboard() {
  const session = await verifySession();
  const userRole = session?.user?.role; // 'role'이 세션 객체에 포함되어 있다고 가정합니다

  if (userRole === "admin") {
    return <AdminDashboard />;
  } else if (userRole === "user") {
    return <UserDashboard />;
  } else {
    redirect("/login");
  }
}
```

이 예시에서는 DAL의 `verifySession()` 함수로 'admin', 'user', 그리고 권한 없는 역할을 확인합니다. 이 패턴을 사용하면 각 사용자가 자신의 역할에 맞는 컴포넌트만 다루게 됩니다.

### 레이아웃과 인증 검사

[부분 렌더링](/docs/app/getting-started/linking-and-navigating#client-side-transitions) 때문에 [레이아웃](/docs/app/api-reference/file-conventions/layout)에서 검사를 수행할 때는 주의해야 합니다. 레이아웃은 내비게이션 시 다시 렌더링되지 않으므로, 라우트가 바뀔 때마다 사용자 세션이 검사되지는 않기 때문입니다.

또한 레이아웃은 나머지 라우트의 렌더링 여부를 제어하지 않습니다. 라우트 세그먼트와 [병렬 라우트 슬롯](/docs/app/api-reference/file-conventions/parallel-routes#conditional-routes)은 라우터가 렌더링하므로, 레이아웃이 이들을 숨기거나 교체하더라도 실행을 막거나 [RSC 페이로드](/docs/app/glossary#rsc-payload)에 나타나는 것을 막지는 못합니다.

대신 데이터 소스와 가까운 곳, 또는 조건부로 렌더링될 컴포넌트에서 검사를 수행해야 합니다.

예를 들어 사용자 데이터를 가져와 내비게이션에 사용자 이미지를 표시하는 공유 레이아웃이 있다고 합시다. 레이아웃에서 인증 검사를 하는 대신, 레이아웃에서는 사용자 데이터를 가져오고(`getUser()`) 인증 검사는 [DAL](#데이터-접근-계층dal-만들기)에서 수행해야 합니다.

이렇게 하면 애플리케이션 어디에서 `getUser()`를 호출하든 인증 검사가 수행되며, 개발자가 데이터 접근 권한 확인을 깜빡하는 일을 막을 수 있습니다.

#### 인증과 스트리밍

세션과 사용자 데이터는 여러 라우트에 걸쳐 반복되는 셸 UI(헤더, 내비게이션)에 자주 등장합니다. 레이아웃에서 `cookies()`, `headers()`, 또는 DAL을 최상위에서 `await` 하면 해당 세그먼트의 첫 스트리밍 청크가 지연되고 `{children}`도 그 작업이 끝날 때까지 묶이게 됩니다.

셸의 일부만 세션 데이터가 필요하다면(예: 사용자 메뉴), `await`를 중첩된 서버 컴포넌트로 옮기고 `<Suspense>`로 감싸서 나머지 페이지가 먼저 스트리밍되도록 하세요. 이 패턴은 [동적 접근을 아래로 내리기](/docs/app/guides/streaming#push-dynamic-access-down)를 참고하세요.

클라이언트 컴포넌트는 DAL을 import할 수 없습니다. `verifySession()`이나 `getUser()` 같은 함수는 상위 서버 컴포넌트에서 실행한 뒤, 그 데이터를 props나 컨텍스트 프로바이더를 통해 클라이언트 자식에게 전달하세요. 해당 패턴은 [컨텍스트 프로바이더 안에서 React의 `use` 사용하기](/docs/app/guides/single-page-applications#using-reacts-use-within-a-context-provider)를 참고하고, 민감한 세션 필드가 클라이언트에 도달하지 않도록 React의 [`taintUniqueValue`](https://react.dev/reference/react/experimental_taintUniqueValue) API를 사용하세요.

#### 페이지 컴포넌트에서의 인증 검사

예를 들어 대시보드 페이지에서는 사용자 세션을 검증한 뒤 사용자 데이터를 가져올 수 있습니다.

```tsx filename="app/dashboard/page.tsx" switcher
import { verifySession } from "@/app/lib/dal";

export default async function DashboardPage() {
  const session = await verifySession();

  // 데이터베이스나 데이터 소스에서 사용자별 데이터를 가져옵니다
  const user = await getUserData(session.userId);

  return (
    <div>
      <h1>Welcome, {user.name}</h1>
      {/* 대시보드 콘텐츠 */}
    </div>
  );
}
```

#### 리프 컴포넌트에서의 인증 검사

사용자 권한에 따라 UI 요소를 조건부로 렌더링하는 리프 컴포넌트에서도 인증 검사를 수행할 수 있습니다. 예를 들어 관리자 전용 동작을 표시하는 컴포넌트는 다음과 같습니다.

```tsx filename="app/ui/admin-actions.tsx" switcher
import { verifySession } from "@/app/lib/dal";

export default async function AdminActions() {
  const session = await verifySession();
  const userRole = session?.user?.role;

  if (userRole !== "admin") {
    return null;
  }

  return (
    <div>
      <button>Delete User</button>
      <button>Edit Settings</button>
    </div>
  );
}
```

이 패턴을 사용하면 사용자 권한에 따라 UI 요소를 보이거나 숨기면서도, 각 컴포넌트의 렌더링 시점에 인증 검사가 반드시 수행되도록 할 수 있습니다.

> **알아두기:**
>
> - SPA에서 흔히 쓰는 패턴으로, 권한이 없는 사용자에게 레이아웃이나 최상위 컴포넌트에서 `return null`을 반환하는 방식이 있습니다. 이 패턴은 **권장하지 않습니다**. Next.js 애플리케이션에는 진입점이 여러 개이므로, 중첩된 라우트 세그먼트나 서버 액션에 접근하는 것을 막지 못하기 때문입니다.
> - 이런 컴포넌트에서 호출하는 서버 액션도 각자 인가 검사를 수행해야 합니다. 클라이언트 측 UI 제한만으로는 보안이 충분하지 않습니다.

### 서버 액션

[서버 액션](/docs/app/guides/server-actions)은 외부에 공개된 API 엔드포인트와 동일한 보안 기준으로 다루고, 사용자가 데이터 변경을 수행할 권한이 있는지 반드시 확인하세요.

아래 예시에서는 액션을 진행하기 전에 사용자의 역할을 확인합니다.

```ts filename="app/lib/actions.ts" switcher
"use server";
import { verifySession } from "@/app/lib/dal";

export async function serverAction(formData: FormData) {
  const session = await verifySession();
  const userRole = session?.user?.role;

  // 사용자가 해당 작업을 수행할 권한이 없으면 일찍 반환합니다
  if (userRole !== "admin") {
    return null;
  }

  // 권한이 있는 사용자에 대해서만 작업을 진행합니다
}
```

### 라우트 핸들러

[라우트 핸들러](/docs/app/api-reference/file-conventions/route)도 외부에 공개된 API 엔드포인트와 동일한 보안 기준으로 다루고, 사용자가 해당 라우트 핸들러에 접근할 권한이 있는지 확인하세요.

예를 들면 다음과 같습니다.

```ts filename="app/api/route.ts" switcher
import { verifySession } from "@/app/lib/dal";

export async function GET() {
  // 사용자 인증과 역할 검증
  const session = await verifySession();

  // 사용자가 인증되었는지 확인합니다
  if (!session) {
    // 인증되지 않은 사용자입니다
    return new Response(null, { status: 401 });
  }

  // 사용자가 'admin' 역할을 가지고 있는지 확인합니다
  if (session.user.role !== "admin") {
    // 인증은 되었지만 권한이 없는 사용자입니다
    return new Response(null, { status: 403 });
  }

  // 권한이 있는 사용자에 대해서만 계속 진행합니다
}
```

위 예시는 2단계 보안 검사를 수행하는 라우트 핸들러를 보여줍니다. 먼저 활성 세션이 있는지 확인하고, 그다음 로그인한 사용자가 'admin'인지 검증합니다.
