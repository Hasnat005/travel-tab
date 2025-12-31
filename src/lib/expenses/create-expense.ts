import { z } from "zod";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type CreateExpenseErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "INTERNAL_ERROR";

export interface CreateExpenseResult {
  expense_id: string;
}

export type CreateExpenseResponse =
  | { ok: true; data: CreateExpenseResult }
  | {
      ok: false;
      error: {
        code: CreateExpenseErrorCode;
        message: string;
        details?: unknown;
      };
    };

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
            amount_owed: moneySchema.refine((v) => v > 0, "amount_owed must be > 0"),
          })
          .strict()
      )
      .min(1, "shares must have at least one entry")
      .refine(uniqueByUserId, "shares must not contain duplicate user_id values"),
  })
  .strict()
  .superRefine((input, ctx) => {
    const totalCents = toCents(input.total_amount);
    const paidCents = input.payers.reduce((sum, p) => sum + toCents(p.amount_paid), 0);
    const owedCents = input.shares.reduce((sum, s) => sum + toCents(s.amount_owed), 0);

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

export type CreateExpenseInput = z.infer<typeof createExpenseInputSchema>;

type PrismaClientForExpenses = {
  $transaction<T>(fn: (tx: PrismaClientForExpenses) => Promise<T>): Promise<T>;
  trip: {
    findUnique(args: {
      where: { id: string };
      select: { id: true };
    }): Promise<{ id: string } | null>;
  };
  tripMember: {
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
      data: Array<{ expense_id: string; user_id: string; amount_paid: Prisma.Decimal }>;
    }): Promise<{ count: number }>;
  };
  expenseShare: {
    createMany(args: {
      data: Array<{ expense_id: string; user_id: string; amount_owed: Prisma.Decimal }>;
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

export async function createExpenseForUser(
  inputRaw: unknown,
  performedByUserId: string
): Promise<CreateExpenseResponse> {
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

  if (!uniqueByUserId(input.payers)) {
    return {
      ok: false,
      error: { code: "VALIDATION_ERROR", message: "Duplicate payer user_id values are not allowed." },
    };
  }
  if (!uniqueByUserId(input.shares)) {
    return {
      ok: false,
      error: { code: "VALIDATION_ERROR", message: "Duplicate share user_id values are not allowed." },
    };
  }

  try {
    const expenseId = await prismaClient.$transaction(async (tx) => {
      const trip = await tx.trip.findUnique({
        where: { id: input.trip_id },
        select: { id: true },
      });
      if (!trip) {
        throw new Error("Trip not found.");
      }

      const membership = await tx.tripMember.findUnique({
        where: { trip_id_user_id: { trip_id: input.trip_id, user_id: performedByUserId } },
        select: { trip_id: true, user_id: true },
      });
      if (!membership) {
        return null;
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
          performer: { connect: { id: performedByUserId } },
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
        error: { code: "FORBIDDEN", message: "You are not a member of this trip." },
      };
    }

    return { ok: true, data: { expense_id: expenseId } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create expense.";

    if (message === "Trip not found.") {
      return { ok: false, error: { code: "VALIDATION_ERROR", message } };
    }

    return {
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to create expense." },
    };
  }
}
