import { NextResponse } from "next/server";

import { createExpense } from "@/app/_actions/expenses";

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
 */
export async function POST(req: Request) {
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

  const result = await createExpense(body);

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
