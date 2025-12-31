import { NextResponse } from "next/server";

import { createClient } from "@supabase/supabase-js";

import { createExpenseApiForUserId } from "@/app/_actions/expenses";
import { prisma } from "@/lib/prisma";
import { getSupabaseEnv } from "@/lib/supabase/env";

/**
 * POST /api/expenses
 *
 * REST-like API wrapper around the internal createExpense implementation.
 *
 * Returns a predictable JSON shape:
 * - Success: { ok: true, data: { expense_id } }
 * - Failure: { ok: false, error: { code, message, details? } }
 *
 * Status mapping:
 * - Validation errors: 400
 * - Authentication errors: 401
 * - Authorization errors: 403
 * - Transaction/internal errors: 500
 *
 * Expected input JSON:
 * {
 *   trip_id: string,
 *   description: string,
 *   total_amount: number,
 *   date: string,
 *   payers: Array<{ user_id: string, amount_paid: number }>,
 *   shares: Array<{ user_id: string, amount_owed: number }>
 * }
 *
 * Notes:
 * - Detailed validation rules live in the Zod schema in the Server Action module.
 * - This handler is thin by design: it parses JSON, delegates to createExpense,
 *   then maps error codes to HTTP status.
 */
export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization") ?? "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "UNAUTHENTICATED",
          message: "Missing Authorization Bearer token.",
        },
      },
      { status: 401 }
    );
  }

  const token = match[1]?.trim();
  if (!token) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "UNAUTHENTICATED",
          message: "Invalid Authorization header.",
        },
      },
      { status: 401 }
    );
  }

  const { url: supabaseUrl, anonKey } = getSupabaseEnv();
  const supabase = createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "UNAUTHENTICATED",
          message: "Invalid or expired token.",
        },
      },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Request body must be valid JSON.",
        },
      },
      { status: 400 }
    );
  }

  // Ensure a matching row exists in public.User for FK integrity.
  await prisma.user.upsert({
    where: { id: user.id },
    create: {
      id: user.id,
      email: user.email ?? `${user.id}@example.invalid`,
      name: typeof user.user_metadata?.name === "string" ? user.user_metadata.name : null,
    },
    update: {
      email: user.email ?? undefined,
      name: typeof user.user_metadata?.name === "string" ? user.user_metadata.name : undefined,
    },
  });

  const result = await createExpenseApiForUserId(body, user.id);

  if (result.ok) {
    return NextResponse.json(result, { status: 201 });
  }

  const status =
    result.error.code === "VALIDATION_ERROR"
      ? 400
      : result.error.code === "UNAUTHENTICATED"
        ? 401
        : result.error.code === "FORBIDDEN"
          ? 403
          : 500;

  return NextResponse.json(result, { status });
}
