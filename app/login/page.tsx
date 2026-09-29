import type { Metadata } from "next";
import Link from "next/link";

import { LoginForm } from "@/components/login-form";
import { safeNextPath } from "@/lib/definitions";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  const nextPath = safeNextPath(typeof next === "string" ? next : null) ?? undefined;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-16">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Log in</h1>
        <p className="mt-2 text-sm text-black/60 dark:text-white/60">
          Demo accounts (password{" "}
          <code className="rounded bg-black/[0.06] px-1 py-0.5 text-xs dark:bg-white/10">Password1!</code>):{" "}
          <code className="rounded bg-black/[0.06] px-1 py-0.5 text-xs dark:bg-white/10">tourist@example.com</code>,{" "}
          <code className="rounded bg-black/[0.06] px-1 py-0.5 text-xs dark:bg-white/10">owner@example.com</code>,{" "}
          <code className="rounded bg-black/[0.06] px-1 py-0.5 text-xs dark:bg-white/10">admin@example.com</code>
        </p>
      </div>

      <LoginForm next={nextPath} />

      <p className="text-sm text-black/60 dark:text-white/60">
        No account yet?{" "}
        <Link href={nextPath ? `/signup?next=${encodeURIComponent(nextPath)}` : "/signup"} className="underline">
          Sign up
        </Link>
      </p>
    </main>
  );
}
