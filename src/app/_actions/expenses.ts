"use server";

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

export interface CreateExpenseInput {
  trip_id: string;
  description: string;
  /** Trip currency amount, e.g. 12.34 */
  total_amount: number;
  /** ISO date string (YYYY-MM-DD) or full ISO timestamp. */
  date: string;

  payers: Array<{ user_id: string; amount_paid: number }>;
  shares: Array<{ user_id: string; amount_owed: number }>;
}

export interface CreateExpenseResult {
  /** New expense id (UUID). */
  expense_id: string;
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
  throw new Error("createExpense is not implemented yet.");
}
