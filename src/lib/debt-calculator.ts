import type {
  BalanceEntry,
  DebtCalculationOutput,
  ExpenseInput,
  SettlementTransaction,
  UserId,
} from "@/lib/debt/types";

const CURRENCY_SCALE = 100;

function toCents(amount: number): number {
  if (!Number.isFinite(amount)) {
    throw new Error(`Invalid amount: ${String(amount)}`);
  }

  // Convert to integer minor units (e.g., cents) to reduce floating-point drift.
  // Rounds to the nearest cent.
  return Math.round((amount + Number.EPSILON) * CURRENCY_SCALE);
}

function fromCents(cents: number): number {
  return cents / CURRENCY_SCALE;
}

type BalanceCentsEntry = { user_id: UserId; cents: number };

function sortByCentsDesc(a: BalanceCentsEntry, b: BalanceCentsEntry) {
  return b.cents - a.cents;
}

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
  const memberSet = new Set(members);
  const balanceCentsByUser = new Map<UserId, number>();

  // Initialize balances for all members at 0.
  for (const memberId of members) {
    balanceCentsByUser.set(memberId, 0);
  }

  for (const expense of expenses) {
    for (const payer of expense.payers) {
      if (!memberSet.has(payer.user_id)) {
        throw new Error(
          `Expense ${expense.id} payer user_id is not a trip member: ${payer.user_id}`
        );
      }
      if (payer.amount_paid < 0) {
        throw new Error(
          `Expense ${expense.id} payer amount_paid must be >= 0 (user_id=${payer.user_id})`
        );
      }

      const delta = toCents(payer.amount_paid);
      balanceCentsByUser.set(
        payer.user_id,
        (balanceCentsByUser.get(payer.user_id) ?? 0) + delta
      );
    }

    for (const share of expense.shares) {
      if (!memberSet.has(share.user_id)) {
        throw new Error(
          `Expense ${expense.id} share user_id is not a trip member: ${share.user_id}`
        );
      }
      if (share.amount_owed < 0) {
        throw new Error(
          `Expense ${expense.id} share amount_owed must be >= 0 (user_id=${share.user_id})`
        );
      }

      const delta = toCents(share.amount_owed);
      balanceCentsByUser.set(
        share.user_id,
        (balanceCentsByUser.get(share.user_id) ?? 0) - delta
      );
    }
  }

  const netBalances: Record<UserId, number> = {};
  const creditors: BalanceEntry[] = [];
  const debtors: BalanceEntry[] = [];
  const creditorCents: BalanceCentsEntry[] = [];
  const debtorCents: BalanceCentsEntry[] = [];

  let netSumCents = 0;
  for (const memberId of members) {
    const cents = balanceCentsByUser.get(memberId) ?? 0;
    const amount = fromCents(cents);
    netBalances[memberId] = amount;

    netSumCents += cents;

    if (cents > 0) {
      creditors.push({ user_id: memberId, amount });
      creditorCents.push({ user_id: memberId, cents });
    } else if (cents < 0) {
      debtors.push({ user_id: memberId, amount: fromCents(Math.abs(cents)) });
      debtorCents.push({ user_id: memberId, cents: Math.abs(cents) });
    }
  }

  if (netSumCents !== 0) {
    throw new Error(
      `Net balances do not sum to zero (${fromCents(
        netSumCents
      )}). Check that totalPaid equals totalOwed across all expenses.`
    );
  }

  creditorCents.sort(sortByCentsDesc);
  debtorCents.sort(sortByCentsDesc);

  // Min Cash Flow-style greedy matching.
  // Each step fully settles either the current largest debtor or creditor,
  // ensuring no redundant (0-amount) transactions and preventing cycles.
  const settlements: SettlementTransaction[] = [];
  let i = 0;
  let j = 0;

  while (i < debtorCents.length && j < creditorCents.length) {
    const debtor = debtorCents[i];
    const creditor = creditorCents[j];

    const transferCents = Math.min(debtor.cents, creditor.cents);

    if (transferCents > 0) {
      // Debtor sends money to creditor.
      settlements.push({
        payer_id: creditor.user_id,
        payee_id: debtor.user_id,
        amount: fromCents(transferCents),
      });
    }

    debtor.cents -= transferCents;
    creditor.cents -= transferCents;

    if (debtor.cents === 0) i++;
    if (creditor.cents === 0) j++;
  }

  // Defensive check: if either side has remaining cents, input data is inconsistent.
  const remainingDebtors = debtorCents.slice(i).reduce((sum, e) => sum + e.cents, 0);
  const remainingCreditors = creditorCents
    .slice(j)
    .reduce((sum, e) => sum + e.cents, 0);
  if (remainingDebtors !== 0 || remainingCreditors !== 0) {
    throw new Error(
      "Unsettled balances remain after simplification. Check inputs for rounding or membership issues."
    );
  }

  return { netBalances, creditors, debtors, settlements };
}
