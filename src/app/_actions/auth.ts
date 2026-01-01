"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

function parseUsername(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(raw)) return null;
  return raw;
}

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
  const username = parseUsername(formData.get("username"));
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!username) {
    redirect(buildRedirectPath(
      "/signup",
      "Username is required (3–20 characters: letters, numbers, underscore)."
    ));
  }

  if (!email || !password) {
    redirect(buildRedirectPath("/signup", "Email and password are required."));
  }

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    redirect(buildRedirectPath("/signup", "Username is already taken."));
  }

  const supabase = await createSupabaseServerClient();
  const origin = await getOrigin();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      data: {
        username,
      },
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
        username:
          typeof data.user.user_metadata?.username === "string"
            ? data.user.user_metadata.username
            : username,
      },
      update: {
        email: data.user.email ?? undefined,
        name:
          typeof data.user.user_metadata?.name === "string"
            ? data.user.user_metadata.name
            : undefined,
        username:
          typeof data.user.user_metadata?.username === "string"
            ? data.user.user_metadata.username
            : username,
      },
    });
  }

  redirect("/login");
}

export async function signIn(formData: FormData) {
  const identifierRaw = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!identifierRaw || !password) {
    redirect(buildRedirectPath("/login", "Username and password are required."));
  }

  const isEmail = identifierRaw.includes("@");
  const username = isEmail ? null : parseUsername(identifierRaw);

  if (!isEmail && !username) {
    redirect(
      buildRedirectPath(
        "/login",
        "Username must be 3–20 characters (letters, numbers, underscore)."
      )
    );
  }

  const loginEmail = isEmail
    ? identifierRaw
    : (await prisma.user.findUnique({ where: { username: username! } }))?.email;

  if (!loginEmail) {
    redirect(buildRedirectPath("/login", "Invalid username or password."));
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: loginEmail,
    password,
  });

  if (error) {
    redirect(buildRedirectPath("/login", error.message));
  }

  if (data.user) {
    const username =
      typeof data.user.user_metadata?.username === "string"
        ? parseUsername(data.user.user_metadata.username)
        : null;

    await prisma.user.upsert({
      where: { id: data.user.id },
      create: {
        id: data.user.id,
        email: data.user.email ?? `${data.user.id}@example.invalid`,
        name:
          typeof data.user.user_metadata?.name === "string"
            ? data.user.user_metadata.name
            : null,
        username: username,
      },
      update: {
        email: data.user.email ?? undefined,
        name:
          typeof data.user.user_metadata?.name === "string"
            ? data.user.user_metadata.name
            : undefined,
        username: username ?? undefined,
      },
    });
  }

  redirect("/trips");
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect(buildRedirectPath("/login", "Signed out."));
}
