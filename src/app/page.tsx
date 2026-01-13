import Link from "next/link";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-black">
        <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-white">Split travel expenses. Settle up fast.</h1>
        <p className="mt-3 max-w-2xl text-base text-gray-700 dark:text-zinc-300">
          TravelTab helps groups track shared expenses, calculate net balances, and generate a simple settlement plan.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          {user ? (
            <>
              <Link
                href="/trips"
                className="inline-flex h-11 items-center justify-center rounded-full bg-foreground px-5 text-sm font-medium text-background"
              >
                Go to trips
              </Link>
              <Link
                href="/account"
                className="inline-flex h-11 items-center justify-center rounded-full border border-black/[.08] px-5 text-sm font-medium transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
              >
                View account
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/signup"
                className="inline-flex h-11 items-center justify-center rounded-full bg-foreground px-5 text-sm font-medium text-background"
              >
                Create an account
              </Link>
              <Link
                href="/login"
                className="inline-flex h-11 items-center justify-center rounded-full border border-black/[.08] px-5 text-sm font-medium transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
              >
                Log in
              </Link>
            </>
          )}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-black/[.08] bg-white p-4 dark:border-white/[.145] dark:bg-black">
          <h2 className="text-sm font-semibold text-black dark:text-white">Track expenses</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-zinc-400">
            Add expenses with payers and shares.
          </p>
        </div>
        <div className="rounded-lg border border-black/[.08] bg-white p-4 dark:border-white/[.145] dark:bg-black">
          <h2 className="text-sm font-semibold text-black dark:text-white">See balances</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-zinc-400">
            Understand who owes and who gets back.
          </p>
        </div>
        <div className="rounded-lg border border-black/[.08] bg-white p-4 dark:border-white/[.145] dark:bg-black">
          <h2 className="text-sm font-semibold text-black dark:text-white">Settle in fewer payments</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-zinc-400">
            Generate a simplified settlement plan.
          </p>
        </div>
      </section>
    </div>
  );
}
