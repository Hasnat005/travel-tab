import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { claimInviteToken, INVITE_COOKIE_NAME, inviteCookieOptions } from "@/lib/invites";

export async function GET(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const normalized = String(token ?? "").trim();

  const url = new URL(request.url);

  if (!normalized) {
    return NextResponse.redirect(new URL("/", url.origin));
  }

  // Validate invite exists and is usable.
  const invite = await prisma.tripInvitation.findUnique({
    where: { token: normalized },
    select: { status: true },
  });

  if (!invite || invite.status !== "active") {
    return NextResponse.redirect(new URL(`/join/${encodeURIComponent(normalized)}`, url.origin));
  }

  const pendingCookies: Array<{
    name: string;
    value: string;
    options: Parameters<NextResponse["cookies"]["set"]>[2];
  }> = [];

  const { url: supabaseUrl, anonKey } = getSupabaseEnv();
  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookies) {
        for (const { name, value, options } of cookies) {
          pendingCookies.push({ name, value, options });
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const res = NextResponse.redirect(new URL("/login", url.origin));
    for (const { name, value, options } of pendingCookies) {
      res.cookies.set(name, value, options);
    }
    res.cookies.set(INVITE_COOKIE_NAME, normalized, inviteCookieOptions());
    return res;
  }

  // Logged in: claim immediately and redirect to the trip.
  const claimed = await claimInviteToken(user.id, normalized);
  const destination = claimed.tripId
    ? `/trips/${claimed.tripId}`
    : `/join/${encodeURIComponent(normalized)}`;

  const res = NextResponse.redirect(new URL(destination, url.origin));
  for (const { name, value, options } of pendingCookies) {
    res.cookies.set(name, value, options);
  }
  // Clear any existing invite cookie (idempotent).
  res.cookies.set(INVITE_COOKIE_NAME, "", {
    path: "/",
    maxAge: 0,
  });
  return res;
}
