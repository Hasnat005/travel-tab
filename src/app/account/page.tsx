import { redirect } from "next/navigation";

import { signOut } from "@/app/_actions/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import MaterialCard from "@/components/ui/MaterialCard";
import MaterialButton from "@/components/ui/MaterialButton";

export default async function AccountPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <MaterialCard>
        <h1 className="text-2xl font-semibold tracking-tight text-[#E3E3E3]">Account</h1>

        <div className="mt-6 rounded-[18px] bg-[#2A2A2A] p-4">
          <p className="text-sm text-[#C4C7C5]">Signed in as</p>
          <p className="mt-1 break-words text-base font-medium text-[#E3E3E3]">{user.email}</p>
          <p className="mt-3 break-words text-xs text-[#C4C7C5]">User ID: {user.id}</p>
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
