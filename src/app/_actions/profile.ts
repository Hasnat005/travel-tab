"use server";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

function buildRedirectPath(pathname: string, message: string) {
  const params = new URLSearchParams({ message });
  return `${pathname}?${params.toString()}`;
}

function parseUsername(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(raw)) return null;
  return raw;
}

export async function updateUsername(formData: FormData) {
  const username = parseUsername(formData.get("username"));
  if (!username) {
    redirect(
      buildRedirectPath(
        "/account",
        "Username is required (3–20 characters: letters, numbers, underscore)."
      )
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(buildRedirectPath("/login", "Please log in."));
  }

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { username },
    });
  } catch {
    redirect(buildRedirectPath("/account", "Username is already taken."));
  }

  redirect(buildRedirectPath("/account", "Username updated."));
}
