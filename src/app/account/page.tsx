import { redirect } from "next/navigation";

import { signOut } from "@/app/_actions/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AccountPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      <main className="w-full max-w-md rounded-2xl bg-white p-8 dark:bg-black">
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
          Account
        </h1>

        <div className="mt-6 rounded-xl border border-black/[.08] p-4 dark:border-white/[.145]">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Signed in as</p>
          <p className="mt-1 text-base font-medium text-black dark:text-zinc-50">
            {user.email}
          </p>
          <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-500">
            User ID: {user.id}
          </p>
        </div>

        <form action={signOut} className="mt-6">
          <button
            type="submit"
            className="flex h-11 w-full items-center justify-center rounded-full border border-solid border-black/[.08] px-5 transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
          >
            Sign out
          </button>
        </form>
      </main>
    </div>
  );
}
