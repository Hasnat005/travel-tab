import Link from "next/link";

import { signIn } from "@/app/_actions/auth";
import MaterialCard from "@/components/ui/MaterialCard";
import MaterialButton from "@/components/ui/MaterialButton";
import MaterialInput from "@/components/ui/MaterialInput";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ message?: string }>;
}) {
  const params = (await searchParams) ?? {};

  return (
    <div className="mx-auto w-full max-w-md">
      <MaterialCard>
        <h1 className="text-2xl font-semibold tracking-tight text-[#E3E3E3]">Log in</h1>

        {params.message ? (
          <p className="mt-3 rounded-[18px] bg-white/5 px-4 py-3 text-sm text-[#C4C7C5]">
            {params.message}
          </p>
        ) : null}

        <form action={signIn} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-[#E3E3E3]">Username</span>
            <MaterialInput
              name="username"
              required
              autoComplete="username"
              placeholder="e.g., hasnat005"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-[#E3E3E3]">Password</span>
            <MaterialInput
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
          </label>

          <MaterialButton type="submit" variant="filled" className="mt-1 w-full">
            Log in
          </MaterialButton>
        </form>

        <p className="mt-6 text-sm text-[#C4C7C5]">
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="font-medium text-[#E3E3E3]"
          >
            Sign up
          </Link>
        </p>
      </MaterialCard>
    </div>
  );
}
