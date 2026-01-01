"use server";

import { z } from "zod";

import { revalidatePath } from "next/cache";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

/**
 * Server Actions for expense operations.
 *
 * Decision: Server Actions (not Route Handlers)
 * - This app already uses Server Actions for auth in `src/app/_actions/auth.ts`.
 * - Creating an expense is typically initiated from a form in the App Router UI.
 * - Server Actions provide type-friendly, CSRF-resistant-by-default form handling without adding an extra REST surface.
 *
 * If we later need third-party / mobile clients, we can add `app/api/expenses` Route Handlers in addition.
 */

/**
 * createExpense input contract (runtime validated)
 *
 * Expected input:
 * - trip_id: UUID string
 * - description: non-empty string
 * - total_amount: number (> 0) with at most 2 decimal places
 * - date: ISO-ish date string parseable by `Date.parse`
 * - payers[]: at least 1 entry
 *   - user_id: UUID string
 *   - amount_paid: number (> 0) with at most 2 decimal places
 * - shares[]: at least 1 entry
 *   - user_id: UUID string
 *   - amount_owed: number (> 0) with at most 2 decimal places
 *
 * Validation rules:
 * - Unknown keys are rejected (`.strict()` on all objects)
 * - No duplicate user_id values in `payers` or `shares`
 * - Financial boundary enforcement (in cents):
 *   - sum(payers.amount_paid) === total_amount
 *   - sum(shares.amount_owed) === total_amount
 */

const moneySchema = z
  .number()
  .finite()
  .min(0)
  .refine(
    (v) => Math.round((v + Number.EPSILON) * 100) === (v + Number.EPSILON) * 100,
    "Amount must have at most 2 decimal places."
  );

function toCents(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100);
}

function uniqueByUserId<T extends { user_id: string }>(items: T[]): boolean {
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.user_id)) return false;
    seen.add(item.user_id);
  }
  return true;
}

/**
 * Strict runtime schema for createExpense.
 * - `.strict()` rejects unknown keys (hardens against malformed requests)
 * - Currency amounts are validated to be finite and 2-decimal max
 */
const createExpenseInputSchema = z
  .object({
    trip_id: z.string().uuid(),
    description: z.string().trim().min(1),
    total_amount: moneySchema.refine((v) => v > 0, "total_amount must be > 0"),
    date: z
      .string()
      .trim()
      .min(1)
      .refine((s) => !Number.isNaN(Date.parse(s)), "date must be a valid ISO date string"),
    payers: z
      .array(
        z
          .object({
            user_id: z.string().uuid(),
            amount_paid: moneySchema.refine((v) => v > 0, "amount_paid must be > 0"),
          })
          .strict()
      )
      .min(1, "payers must have at least one entry")
      .refine(uniqueByUserId, "payers must not contain duplicate user_id values"),
    shares: z
      .array(
        z
          .object({
            user_id: z.string().uuid(),
            amount_owed: moneySchema,
          })
          .strict()
      )
      .min(1, "shares must have at least one entry")
      .refine(uniqueByUserId, "shares must not contain duplicate user_id values"),
  })
  .strict()
  .superRefine((input, ctx) => {
    const totalCents = toCents(input.total_amount);
    const paidCents = input.payers.reduce(
      (sum, p) => sum + toCents(p.amount_paid),
      0
    );
    const owedCents = input.shares.reduce(
      (sum, s) => sum + toCents(s.amount_owed),
      0
    );

    if (paidCents !== totalCents) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["payers"],
        message: "Sum of payers.amount_paid must equal total_amount.",
      });
    }

    if (owedCents !== totalCents) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["shares"],
        message: "Sum of shares.amount_owed must equal total_amount.",
      });
    }
  });

/**
 * TypeScript input contract for createExpense.
 * Keep this in sync with runtime validation by deriving it from Zod.
 */
interface CreateExpenseResult {
  /** New expense id (UUID). */
  expense_id: string;
}

type CreateExpenseErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "INTERNAL_ERROR";

type CreateExpenseResponse =
  | { ok: true; data: CreateExpenseResult }
  | {
      ok: false;
      error: {
        code: CreateExpenseErrorCode;
        message: string;
        details?: unknown;
      };
    };

/**
 * Creates an expense for a trip.
 *
 * Returns a predictable response shape (usable by both Server Actions and Route Handlers):
 * - Success: { ok: true, data: { expense_id } }
 * - Failure: { ok: false, error: { code, message, details? } }
 *
 * Error code semantics:
 * - VALIDATION_ERROR: malformed input, sums don't match, or trip_id doesn't exist
 * - UNAUTHENTICATED: no signed-in user
 * - FORBIDDEN: user is signed in but not a member of the trip
 * - INTERNAL_ERROR: unexpected / transactional failure
 *
 * Transaction behavior:
 * - All database writes are performed within a single Prisma `$transaction`:
 *   1) verify trip exists
 *   2) verify caller is a TripMember (authorization)
 *   3) create Expense
 *   4) createMany ExpensePayer rows
 *   5) createMany ExpenseShare rows
 *   6) create TripLog audit record (EXPENSE_CREATED)
 * - Any failure rolls back all writes.
 *
 * Side effects (audit logs):
 * - On success, a TripLog row is inserted with action_type EXPENSE_CREATED,
 *   performed_by = authenticated user id, and details JSON containing:
 *   expense_id, total_amount, description.
 */
async function createExpenseInternal(
  inputRaw: unknown,
  userId: string
): Promise<CreateExpenseResponse> {
  // Boundary validation BEFORE touching the database.
  // Ensures financial consistency: sum(amount_paid) == total_amount and sum(amount_owed) == total_amount.
  const parsed = createExpenseInputSchema.safeParse(inputRaw);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid createExpense input.",
        details: parsed.error.flatten(),
      },
    };
  }

  const input = parsed.data;

  // NOTE: If your editor shows red squiggles like "Property 'trip' does not exist on type PrismaClient",
  // it usually means Prisma Client types are stale in the TS server. `next build` should be the source of truth.
  // This cast avoids blocking development while keeping runtime behavior the same.
  type PrismaClientForExpenses = {
    $transaction<T>(fn: (tx: PrismaClientForExpenses) => Promise<T>): Promise<T>;
    trip: {
      findUnique(args: {
        where: { id: string };
        select: { id: true };
      }): Promise<{ id: string } | null>;
    };
    tripMember: {
      findMany(args: {
        where: { trip_id: string };
        select: { user_id: true };
      }): Promise<Array<{ user_id: string }>>;
      findUnique(args: {
        where: { trip_id_user_id: { trip_id: string; user_id: string } };
        select: { trip_id: true; user_id: true };
      }): Promise<{ trip_id: string; user_id: string } | null>;
    };
    expense: {
      create(args: {
        data: {
          trip: { connect: { id: string } };
          description: string;
          total_amount: Prisma.Decimal;
          date: Date;
        };
        select: { id: true };
      }): Promise<{ id: string }>;
    };
    expensePayer: {
      createMany(args: {
        data: Array<{
          expense_id: string;
          user_id: string;
          amount_paid: Prisma.Decimal;
        }>;
      }): Promise<{ count: number }>;
    };
    expenseShare: {
      createMany(args: {
        data: Array<{
          expense_id: string;
          user_id: string;
          amount_owed: Prisma.Decimal;
        }>;
      }): Promise<{ count: number }>;
    };
    tripLog: {
      create(args: {
        data: {
          trip: { connect: { id: string } };
          action_type: "EXPENSE_CREATED";
          performer: { connect: { id: string } };
          details: Record<string, unknown>;
          timestamp: Date;
        };
        select: { id: true };
      }): Promise<{ id: string }>;
    };
  };

  const prismaClient = prisma as unknown as PrismaClientForExpenses;

  if (!uniqueByUserId(input.payers)) {
    // Defensive check (schema already enforces this).
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Duplicate payer user_id values are not allowed.",
      },
    };
  }
  if (input.payers.some((p) => p.amount_paid <= 0)) {
    // Defensive check (schema already enforces this).
    return {
      ok: false,
      error: { code: "VALIDATION_ERROR", message: "All payer amounts must be > 0." },
    };
  }
  if (!uniqueByUserId(input.shares)) {
    // Defensive check (schema already enforces this).
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Duplicate share user_id values are not allowed.",
      },
    };
  }
  if (input.shares.some((s) => s.amount_owed <= 0)) {
    // Defensive check (schema already enforces this).
    return {
      ok: false,
      error: { code: "VALIDATION_ERROR", message: "All share amounts must be > 0." },
    };
  }

  try {
    const expenseId = await prismaClient.$transaction(async (tx) => {
      // Ensure the expense is linked to the correct trip.
      // We do an explicit existence check so we can return a clear error.
      const trip = await tx.trip.findUnique({
        where: { id: input.trip_id },
        select: { id: true },
      });
      if (!trip) {
        throw new Error("Trip not found.");
      }

      // Authorization: must be a member of the trip.
      const membership = await tx.tripMember.findUnique({
        where: {
          trip_id_user_id: {
            trip_id: input.trip_id,
            user_id: userId,
          },
        },
        select: { trip_id: true, user_id: true },
      });
      if (!membership) {
        // Distinguish from authentication (401).
        return null;
      }

      // Validation: all referenced payers/shares must be members of this trip.
      const tripMembers = await tx.tripMember.findMany({
        where: { trip_id: input.trip_id },
        select: { user_id: true },
      });
      const memberSet = new Set(tripMembers.map((m) => m.user_id));

      const invalidPayer = input.payers.find((p) => !memberSet.has(p.user_id));
      if (invalidPayer) {
        throw new Error("All payers must be members of this trip.");
      }

      const invalidShare = input.shares.find((s) => !memberSet.has(s.user_id));
      if (invalidShare) {
        throw new Error("All shares must be members of this trip.");
      }

      const expense = await tx.expense.create({
        data: {
          trip: { connect: { id: input.trip_id } },
          description: input.description,
          total_amount: new Prisma.Decimal(input.total_amount),
          date: new Date(input.date),
        },
        select: { id: true },
      });

      await tx.expensePayer.createMany({
        data: input.payers.map((payer) => ({
          expense_id: expense.id,
          user_id: payer.user_id,
          amount_paid: new Prisma.Decimal(payer.amount_paid),
        })),
      });

      await tx.expenseShare.createMany({
        data: input.shares.map((share) => ({
          expense_id: expense.id,
          user_id: share.user_id,
          amount_owed: new Prisma.Decimal(share.amount_owed),
        })),
      });

      await tx.tripLog.create({
        data: {
          trip: { connect: { id: input.trip_id } },
          action_type: "EXPENSE_CREATED",
          performer: { connect: { id: userId } },
          details: {
            expense_id: expense.id,
            total_amount: Number(input.total_amount.toFixed(2)),
            description: input.description,
          },
          timestamp: new Date(),
        },
        select: { id: true },
      });

      return expense.id;
    });

    if (expenseId === null) {
      return {
        ok: false,
        error: {
          code: "FORBIDDEN",
          message: "You are not a member of this trip.",
        },
      };
    }

    return { ok: true, data: { expense_id: expenseId } };
  } catch (error) {
    // Transaction / unexpected failure
    const message =
      error instanceof Error ? error.message : "Failed to create expense.";

    if (message === "Trip not found.") {
      return {
        ok: false,
        error: { code: "VALIDATION_ERROR", message },
      };
    }

    if (message === "All payers must be members of this trip." || message === "All shares must be members of this trip.") {
      return {
        ok: false,
        error: { code: "VALIDATION_ERROR", message },
      };
    }

    return {
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to create expense." },
    };
  }
}

export async function createExpenseApi(inputRaw: unknown): Promise<CreateExpenseResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      error: { code: "UNAUTHENTICATED", message: "Not authenticated." },
    };
  }

  return createExpenseInternal(inputRaw, user.id);
}

export async function createExpenseApiForUserId(
  inputRaw: unknown,
  userId: string
): Promise<CreateExpenseResponse> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "UNAUTHENTICATED", message: "Not authenticated." },
    };
  }

  return createExpenseInternal(inputRaw, userId);
}

type CreateExpenseFormState =
  | { ok: false; message?: string }
  | { ok: true; message?: string };

const createExpenseFormSchema = z
  .object({
    tripId: z.string().uuid(),
    description: z.string().trim().min(1, "Description is required"),
    amount: z
      .string()
      .trim()
      .min(1, "Amount is required")
      .transform((v) => Number(v))
      .refine((v) => Number.isFinite(v) && v > 0, "Amount must be greater than 0"),
    date: z.string().trim().min(1, "Date is required"),
    payload: z.string().trim().optional(),
  })
  .strict();

function parseDateOnly(value: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime())) {
    throw new Error(`Invalid date: ${value}`);
  }
  return date;
}

function splitCentsEqually(totalCents: number, userIds: string[]) {
  if (userIds.length === 0) {
    throw new Error("Cannot split expense with zero members");
  }

  const base = Math.floor(totalCents / userIds.length);
  const remainder = totalCents - base * userIds.length;

  return userIds.map((userId, index) => ({
    user_id: userId,
    amountCents: base + (index < remainder ? 1 : 0),
  }));
}

/**
 * Form-based Server Action for the app UI.
 * Assumptions for now:
 * - "I paid" (current user pays full amount)
 * - split equally across all current trip members
 */
export async function createExpense(
  _prevState: CreateExpenseFormState,
  formData: FormData
): Promise<CreateExpenseFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Not authenticated." };
  }

  const parsed = createExpenseFormSchema.safeParse({
    tripId: formData.get("tripId"),
    description: formData.get("description"),
    amount: formData.get("amount"),
    date: formData.get("date"),
    payload: formData.get("payload"),
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { tripId, description, amount, date, payload } = parsed.data;

  // Advanced mode: client provides explicit payers + shares JSON payload.
  // This enables multi-payer, uneven/partial payments, and custom splits.
  if (payload) {
    let inputRaw: unknown;
    try {
      inputRaw = JSON.parse(payload);
    } catch {
      return { ok: false, message: "Invalid split payload." };
    }

    // Integrity check: ensure form tripId matches payload trip_id.
    if (
      !inputRaw ||
      typeof inputRaw !== "object" ||
      typeof (inputRaw as Record<string, unknown>).trip_id !== "string" ||
      (inputRaw as Record<string, unknown>).trip_id !== tripId
    ) {
      return { ok: false, message: "Split payload trip mismatch." };
    }

    const result = await createExpenseApi(inputRaw);
    if (!result.ok) {
      return { ok: false, message: result.error.message };
    }

    revalidatePath(`/trips/${tripId}`);
    return { ok: true };
  }

  const expenseDate = parseDateOnly(date);
  const totalCents = Math.round((amount + Number.EPSILON) * 100);

  const membership = await prisma.tripMember.findUnique({
    where: { trip_id_user_id: { trip_id: tripId, user_id: user.id } },
    select: { trip_id: true },
  });

  if (!membership) {
    throw new Error("Unauthorized");
  }

  await prisma.$transaction(async (tx) => {
    // Fetch members first to compute equal shares.
    const members = await tx.tripMember.findMany({
      where: { trip_id: tripId },
      select: { user_id: true },
      orderBy: { user_id: "asc" },
    });

    const memberIds = members.map((m) => m.user_id);
    const shares = splitCentsEqually(totalCents, memberIds);

    const expense = await tx.expense.create({
      data: {
        trip_id: tripId,
        description,
        total_amount: new Prisma.Decimal(amount),
        date: expenseDate,
      },
      select: { id: true },
    });

    await tx.expensePayer.createMany({
      data: [
        {
          expense_id: expense.id,
          user_id: user.id,
          amount_paid: new Prisma.Decimal(amount),
        },
      ],
    });

    await tx.expenseShare.createMany({
      data: shares.map((s) => ({
        expense_id: expense.id,
        user_id: s.user_id,
        amount_owed: new Prisma.Decimal((s.amountCents / 100).toFixed(2)),
      })),
    });

    const performer = await tx.user.findUnique({
      where: { id: user.id },
      select: { name: true, email: true, username: true },
    });

    const performerName =
      performer?.username?.trim()
        ? `@${performer.username.trim()}`
        : performer?.name?.trim() || performer?.email || "User";

    await tx.tripLog.create({
      data: {
        trip_id: tripId,
        action_type: "EXPENSE_CREATED",
        performed_by: user.id,
        details: {
          description,
          total_amount: Number(amount.toFixed(2)),
          message: `${performerName} added expense: ${description}`,
        },
        timestamp: new Date(),
      },
    });
  });

  revalidatePath(`/trips/${tripId}`);
  return { ok: true };
}
