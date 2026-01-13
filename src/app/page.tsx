import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export default async function Home() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Check if user has any trips to customize the CTA
  const tripCount = user
    ? await prisma.tripMember.count({
        where: { user_id: user.id },
      })
    : 0;

  const hasPrimaryAction = user || !user; // Always show a primary action
  const primaryCTA = user
    ? tripCount > 0
      ? { href: "/trips", label: "View Trips" }
      : { href: "/trips", label: "Create Your First Trip" }
    : { href: "/signup", label: "Get Started" };

  const helperText = user && tripCount === 0 ? "Start tracking expenses with your travel group" : null;

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Hero Section */}
      <section className="rounded-xl border border-white/10 bg-gradient-to-br from-zinc-900 to-black p-6 shadow-lg shadow-black/20">
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Split travel expenses. Settle up fast.
        </h1>
        <p className="mt-3 text-base text-zinc-300 sm:text-lg">
          Track shared expenses and settle balances with minimal payments.
        </p>

        {helperText && (
          <p className="mt-2 text-sm text-zinc-400">{helperText}</p>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            href={primaryCTA.href}
            className="group relative inline-flex h-12 min-w-[160px] items-center justify-center overflow-hidden rounded-xl bg-blue-600 px-6 text-base font-semibold text-white shadow-lg shadow-blue-600/30 transition-all duration-200 hover:bg-blue-500 hover:shadow-xl hover:shadow-blue-600/40 active:scale-[0.98] active:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          >
            <span className="relative z-10">{primaryCTA.label}</span>
            <span className="absolute inset-0 -z-10 bg-gradient-to-r from-blue-600 to-blue-500 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
          </Link>

          {user && (
            <Link
              href="/account"
              className="text-sm font-medium text-zinc-400 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-500"
            >
              Account settings
            </Link>
          )}

          {!user && (
            <Link
              href="/login"
              className="inline-flex h-12 items-center justify-center rounded-xl border border-white/10 px-6 text-base font-medium text-white transition-all duration-200 hover:border-white/20 hover:bg-white/5 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/50"
            >
              Log in
            </Link>
          )}
        </div>
      </section>

      {/* Feature Cards Section */}
      <section className="grid gap-3 sm:grid-cols-3">
        <Link
          href={user ? "/trips" : "/signup"}
          className="group relative flex items-start gap-3 rounded-xl border border-white/10 bg-zinc-900/50 p-4 transition-all duration-200 hover:border-white/20 hover:bg-zinc-900 hover:shadow-lg active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
        >
          <div className="flex-1">
            <h2 className="text-base font-semibold text-white">Add an expense</h2>
            <p className="mt-1 text-sm leading-relaxed text-zinc-400">
              Split bills with your travel group
            </p>
          </div>
          <ChevronRight className="mt-1 h-5 w-5 flex-shrink-0 text-zinc-500 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-zinc-300" />
        </Link>

        <Link
          href={user ? "/trips" : "/signup"}
          className="group relative flex items-start gap-3 rounded-xl border border-white/10 bg-zinc-900/50 p-4 transition-all duration-200 hover:border-white/20 hover:bg-zinc-900 hover:shadow-lg active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
        >
          <div className="flex-1">
            <h2 className="text-base font-semibold text-white">View balances</h2>
            <p className="mt-1 text-sm leading-relaxed text-zinc-400">
              See who owes and who gets paid
            </p>
          </div>
          <ChevronRight className="mt-1 h-5 w-5 flex-shrink-0 text-zinc-500 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-zinc-300" />
        </Link>

        <Link
          href={user ? "/trips" : "/signup"}
          className="group relative flex items-start gap-3 rounded-xl border border-white/10 bg-zinc-900/50 p-4 transition-all duration-200 hover:border-white/20 hover:bg-zinc-900 hover:shadow-lg active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
        >
          <div className="flex-1">
            <h2 className="text-base font-semibold text-white">Settle payments</h2>
            <p className="mt-1 text-sm leading-relaxed text-zinc-400">
              Minimize transactions with smart splits
            </p>
          </div>
          <ChevronRight className="mt-1 h-5 w-5 flex-shrink-0 text-zinc-500 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-zinc-300" />
        </Link>
      </section>
    </div>
  );
}
