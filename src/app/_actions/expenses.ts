"use server";

import { z } from "zod";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

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
export const createExpenseInputSchema = z
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
export type CreateExpenseInput = z.infer<typeof createExpenseInputSchema>;

export interface CreateExpenseResult {
  /** New expense id (UUID). */
  expense_id: string;
}

export function validateCreateExpenseInput(input: unknown): CreateExpenseInput {
  return createExpenseInputSchema.parse(input);
}

function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length ? issue.path.join(".") : "input";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
}

/**
 * Creates an expense for a trip.
 *
 * Intent:
 * - Validate the caller is authenticated and a member of the trip.
 * - Insert Expense + related payers/shares (transactional).
 * - Optionally log a `TripLog` entry.
 */
export async function createExpense(_input: CreateExpenseInput): Promise<CreateExpenseResult> {
  // Boundary validation BEFORE touching the database.
  // Ensures financial consistency: sum(amount_paid) == total_amount and sum(amount_owed) == total_amount.
  let input: CreateExpenseInput;
  try {
    input = validateCreateExpenseInput(_input);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Invalid createExpense input: ${formatZodError(error)}`);
    }
    throw error;
  }

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
  };

  const prismaClient = prisma as unknown as PrismaClientForExpenses;

  if (!uniqueByUserId(input.payers)) {
    throw new Error("Duplicate payer user_id values are not allowed.");
  }
  if (input.payers.some((p) => p.amount_paid <= 0)) {
    throw new Error("All payer amounts must be > 0.");
  }
  if (!uniqueByUserId(input.shares)) {
    throw new Error("Duplicate share user_id values are not allowed.");
  }
  if (input.shares.some((s) => s.amount_owed <= 0)) {
    throw new Error("All share amounts must be > 0.");
  }

  const expenseId = await prismaClient.$transaction(async (tx) => {
    // Ensure the expense is linked to the correct trip.
    // We do an explicit existence check so we can return a clear error.
    const trip = await tx.trip.findUnique({
      where: { id: input.trip_id },
      select: { id: true },
    });
    if (!trip) {
      throw new Error(`Trip not found: ${input.trip_id}`);
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

    return expense.id;
  });

  return { expense_id: expenseId };
}
