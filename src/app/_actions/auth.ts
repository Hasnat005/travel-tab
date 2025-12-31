"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

function buildRedirectPath(pathname: string, message: string) {
  const params = new URLSearchParams({ message });
  return `${pathname}?${params.toString()}`;
}

async function getOrigin() {
  const requestHeaders = await headers();
  return (
    requestHeaders.get("origin") ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000"
  );
}

export async function signUp(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirect(buildRedirectPath("/signup", "Email and password are required."));
  }

  const supabase = await createSupabaseServerClient();
  const origin = await getOrigin();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    redirect(buildRedirectPath("/signup", error.message));
  }

  if (data.user) {
    await prisma.user.upsert({
      where: { id: data.user.id },
      create: {
        id: data.user.id,
        email: data.user.email ?? `${data.user.id}@example.invalid`,
        name:
          typeof data.user.user_metadata?.name === "string"
            ? data.user.user_metadata.name
            : null,
      },
      update: {
        email: data.user.email ?? undefined,
        name:
          typeof data.user.user_metadata?.name === "string"
            ? data.user.user_metadata.name
            : undefined,
      },
    });
  }

  redirect(
    buildRedirectPath(
      "/login",
      "Account created. If email confirmation is enabled, check your inbox to confirm before logging in."
    )
  );
}

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirect(buildRedirectPath("/login", "Email and password are required."));
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect(buildRedirectPath("/login", error.message));
  }

  if (data.user) {
    await prisma.user.upsert({
      where: { id: data.user.id },
      create: {
        id: data.user.id,
        email: data.user.email ?? `${data.user.id}@example.invalid`,
        name:
          typeof data.user.user_metadata?.name === "string"
            ? data.user.user_metadata.name
            : null,
      },
      update: {
        email: data.user.email ?? undefined,
        name:
          typeof data.user.user_metadata?.name === "string"
            ? data.user.user_metadata.name
            : undefined,
      },
    });
  }

  redirect("/account");
}

export async function signInWithGoogle() {
  const supabase = await createSupabaseServerClient();
  const origin = await getOrigin();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    redirect(buildRedirectPath("/login", error.message));
  }

  if (!data.url) {
    redirect(buildRedirectPath("/login", "Failed to start Google sign-in."));
  }

  redirect(data.url);
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect(buildRedirectPath("/login", "Signed out."));
}
