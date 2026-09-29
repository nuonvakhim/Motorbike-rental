import type { Metadata } from "next";
import Link from "next/link";

import { SignupForm } from "@/components/signup-form";
import { safeNextPath } from "@/lib/definitions";

export const metadata: Metadata = { title: "Sign up" };

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const { next, as } = await searchParams;
  const nextPath = safeNextPath(typeof next === "string" ? next : null) ?? undefined;
  const asOwner = as === "owner";

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-16">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {asOwner ? "List your rental shop" : "Create your account"}
        </h1>
        <p className="mt-2 text-sm text-black/60 dark:text-white/60">
          {asOwner
            ? "Free to list. Add your shop and bikes, and answer booking requests from travellers."
            : "Book bikes, keep track of your requests, and review the shops you rode with."}
        </p>
      </div>

      <SignupForm next={nextPath} defaultAccountType={asOwner ? "owner" : "user"} />

      <p className="text-sm text-black/60 dark:text-white/60">
        Already have an account?{" "}
        <Link href={nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login"} className="underline">
          Log in
        </Link>
      </p>
    </main>
  );
}
