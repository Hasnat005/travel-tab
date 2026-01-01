import { redirect } from "next/navigation";

import { signOut } from "@/app/_actions/auth";
import { updateUsername } from "@/app/_actions/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import MaterialCard from "@/components/ui/MaterialCard";
import MaterialButton from "@/components/ui/MaterialButton";
import MaterialInput from "@/components/ui/MaterialInput";

export default async function AccountPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { username: true, name: true, email: true },
  });

  return (
    <div className="mx-auto w-full max-w-md">
      <MaterialCard>
        <h1 className="text-2xl font-semibold tracking-tight text-[#E3E3E3]">Account</h1>

        <div className="mt-6 rounded-[18px] bg-[#2A2A2A] p-4">
          <p className="text-sm text-[#C4C7C5]">Signed in as</p>
          <p className="mt-1 wrap-break-word text-base font-medium text-[#E3E3E3]">{user.email}</p>
          <p className="mt-3 wrap-break-word text-xs text-[#C4C7C5]">User ID: {user.id}</p>
        </div>

        <div className="mt-4 rounded-[18px] bg-[#2A2A2A] p-4">
          <p className="text-sm text-[#C4C7C5]">Username</p>

          {dbUser?.username ? (
            <p className="mt-1 wrap-break-word text-base font-medium text-[#E3E3E3]">@{dbUser.username}</p>
          ) : (
            <p className="mt-1 text-sm text-[#C4C7C5]">No username set yet.</p>
          )}

          <form action={updateUsername} className="mt-4 flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-[#E3E3E3]">Set username</span>
              <MaterialInput
                name="username"
                required
                autoComplete="username"
                defaultValue={dbUser?.username ?? ""}
                placeholder="e.g., hasnat005"
              />
              <span className="text-xs text-[#C4C7C5]">3–20 characters (letters, numbers, underscore)</span>
            </label>
            <MaterialButton type="submit" variant="tonal" className="w-full">
              Save username
            </MaterialButton>
          </form>
        </div>

        <form action={signOut} className="mt-6">
          <MaterialButton type="submit" variant="text" className="w-full">
            Sign out
          </MaterialButton>
        </form>
      </MaterialCard>
    </div>
  );
}
