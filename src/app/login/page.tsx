import Link from "next/link";

import { signIn } from "@/app/_actions/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ message?: string }>;
}) {
  const params = (await searchParams) ?? {};

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      <main className="w-full max-w-md rounded-2xl bg-white p-8 dark:bg-black">
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
          Log in
        </h1>

        {params.message ? (
          <p className="mt-3 rounded-lg border border-black/[.08] px-3 py-2 text-sm text-zinc-700 dark:border-white/[.145] dark:text-zinc-300">
            {params.message}
          </p>
        ) : null}

        <form action={signIn} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Email
            </span>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className="h-11 rounded-lg border border-black/[.08] bg-transparent px-3 text-black outline-none dark:border-white/[.145] dark:text-zinc-50"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Password
            </span>
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="h-11 rounded-lg border border-black/[.08] bg-transparent px-3 text-black outline-none dark:border-white/[.145] dark:text-zinc-50"
            />
          </label>

          <button
            type="submit"
            className="mt-2 flex h-11 items-center justify-center rounded-full bg-foreground px-5 text-background"
          >
            Log in
          </button>
        </form>

        <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="font-medium text-zinc-950 dark:text-zinc-50"
          >
            Sign up
          </Link>
        </p>
      </main>
    </div>
  );
}
