import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

import { getSupabaseEnv } from "@/lib/supabase/env";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/account";

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
      },
      update: {
        email: user.email ?? undefined,
        name:
          typeof user.user_metadata?.name === "string" ? user.user_metadata.name : undefined,
      },
    });
  }

  return response;
}
