import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

import { getSupabaseEnv } from "@/lib/supabase/env";
import { prisma } from "@/lib/prisma";
import { claimInviteToken, INVITE_COOKIE_NAME, inviteCookieOptions } from "@/lib/invites";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = sanitizeNextPath(url.searchParams.get("next")) ?? "/trips";

  if (!code) {
    return NextResponse.redirect(new URL("/login?message=Missing+code", url.origin));
  }

  const response = NextResponse.redirect(new URL(next, url.origin));

  const { url: supabaseUrl, anonKey } = getSupabaseEnv();
  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      new URL(`/login?message=${encodeURIComponent(error.message)}`, url.origin)
    );
  }

  // Ensure a matching row exists in public.User for FK integrity and invites-by-email.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    await prisma.user.upsert({
      where: { id: user.id },
      create: {
        id: user.id,
        email: user.email ?? `${user.id}@example.invalid`,
        name: typeof user.user_metadata?.name === "string" ? user.user_metadata.name : null,
        username:
          typeof user.user_metadata?.username === "string"
            ? user.user_metadata.username
            : null,
      },
      update: {
        email: user.email ?? undefined,
        name:
          typeof user.user_metadata?.name === "string" ? user.user_metadata.name : undefined,
        username:
          typeof user.user_metadata?.username === "string"
            ? user.user_metadata.username
            : undefined,
      },
    });

    const inviteToken = request.cookies.get(INVITE_COOKIE_NAME)?.value?.trim();
    if (inviteToken) {
      try {
        const claimed = await claimInviteToken(user.id, inviteToken);
        if (claimed.tripId) {
          response.headers.set(
            "Location",
            new URL(`/trips/${claimed.tripId}`, url.origin).toString()
          );
        }
      } finally {
        response.cookies.set(INVITE_COOKIE_NAME, "", {
          ...inviteCookieOptions(),
          maxAge: 0,
        });
      }
    }
  }

  return response;
}

function sanitizeNextPath(nextValue: string | null): string | null {
  if (!nextValue) return null;
  // Only allow relative paths to avoid open-redirects.
  if (!nextValue.startsWith("/")) return null;
  if (nextValue.startsWith("//")) return null;
  return nextValue;
}
