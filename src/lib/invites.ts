import "server-only";

import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";

export const INVITE_COOKIE_NAME = "invite_token";

export type ClaimInviteOutcome = "joined" | "already-member" | "invalid" | "revoked";

export async function claimInviteToken(userId: string, token: string): Promise<{
  tripId: string | null;
  outcome: ClaimInviteOutcome;
}> {
  const normalized = token.trim();
  if (!normalized) return { tripId: null, outcome: "invalid" };

  const invite = await prisma.tripInvitation.findUnique({
    where: { token: normalized },
    select: { trip_id: true, status: true },
  });

  if (!invite) return { tripId: null, outcome: "invalid" };
  if (invite.status !== "active") return { tripId: null, outcome: "revoked" };

  const member = await prisma.tripMember.upsert({
    where: { trip_id_user_id: { trip_id: invite.trip_id, user_id: userId } },
    create: { trip_id: invite.trip_id, user_id: userId },
    update: {},
    select: { trip_id: true },
  });

  return { tripId: member.trip_id, outcome: "joined" };
}

export async function claimInviteAfterAuth(userId: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get(INVITE_COOKIE_NAME)?.value?.trim();
  if (!token) return null;

  try {
    const res = await claimInviteToken(userId, token);
    return res.tripId;
  } finally {
    cookieStore.set(INVITE_COOKIE_NAME, "", {
      path: "/",
      maxAge: 0,
    });
  }
}

export function inviteCookieOptions() {
  return {
    path: "/",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  };
}
