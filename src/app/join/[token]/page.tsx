import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { claimInviteToken } from "@/lib/invites";

export default async function JoinTripPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const normalized = String(token ?? "").trim();

  if (!normalized) {
    return (
      <div className="mx-auto w-full max-w-xl px-4 py-10">
        <h1 className="text-xl font-semibold">Invalid invite link</h1>
        <p className="mt-2 text-sm text-black/60 dark:text-zinc-400">This invite link is missing or malformed.</p>
      </div>
    );
  }

  const invite = await prisma.tripInvitation.findUnique({
    where: { token: normalized },
    select: { status: true },
  });

  if (!invite || invite.status !== "active") {
    return (
      <div className="mx-auto w-full max-w-xl px-4 py-10">
        <h1 className="text-xl font-semibold">Invite link not available</h1>
        <p className="mt-2 text-sm text-black/60 dark:text-zinc-400">
          This invite link is invalid or has been revoked.
        </p>
      </div>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Continue in a route handler so we can set the HttpOnly cookie.
    redirect(`/join/${encodeURIComponent(normalized)}/claim`);
  }

  const claimed = await claimInviteToken(user.id, normalized);
  if (claimed.tripId) {
    redirect(`/trips/${claimed.tripId}`);
  }

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-10">
      <h1 className="text-xl font-semibold">Invite link not available</h1>
      <p className="mt-2 text-sm text-black/60 dark:text-zinc-400">
        This invite link is invalid or has been revoked.
      </p>
    </div>
  );
}
