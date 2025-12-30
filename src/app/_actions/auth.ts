"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

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

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    redirect(buildRedirectPath("/signup", error.message));
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

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect(buildRedirectPath("/login", error.message));
  }

  redirect("/account");
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect(buildRedirectPath("/login", "Signed out."));
}
