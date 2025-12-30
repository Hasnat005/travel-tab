import type {
  DebtCalculationOutput,
  ExpenseInput,
  SettlementTransaction,
  UserId,
} from "@/lib/debt/types";

/**
 * Calculate simplified settlement transactions for a trip.
 *
 * Inputs:
 * - `members`: list of user IDs who belong to the trip
 * - `expenses`: list of expenses, each containing:
 *   - `payers`: who paid and how much (`amount_paid`)
 *   - `shares`: who owes and how much (`amount_owed`)
 *
 * Expected behavior (when implemented):
 * - Treat `amount_paid` and `amount_owed` as amounts in the same currency.
 * - Aggregate across all expenses to compute each member's net balance:
 *   - Paid more than owed => net positive (should receive money)
 *   - Owed more than paid => net negative (should send money)
 * - Produce a simplified list of settlement transactions ({ payer_id, payee_id, amount })
 *   that would settle all balances.
 * - Output transactions should:
 *   - Have strictly positive `amount`
 *   - Not include self-transfers (payer_id !== payee_id)
 *   - Only reference user IDs that exist in `members`
 *   - Settle the trip such that total sent equals total received (within rounding rules)
 *
 * Notes:
 * - This function intentionally contains no business logic yet.
 * - When implementing, decide on rounding strategy for decimals (e.g., cents) and ensure
 *   totals remain consistent.
 */
export function calculateTripDebts(
  expenses: ExpenseInput[],
  members: UserId[]
): DebtCalculationOutput {
  void expenses;
  void members;

  // Placeholder until the debt-settlement algorithm is implemented.
  // Keeping the return type explicit ensures downstream code stays type-safe.
  const settlements: SettlementTransaction[] = [];
  return { settlements };
}
