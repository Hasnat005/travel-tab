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
  // Ensure consistent 2-decimal output (avoid 0.30000000000000004-style artifacts).
  return Number((cents / CURRENCY_SCALE).toFixed(2));
}

type BalanceCentsEntry = { user_id: UserId; cents: number };

function sortByCentsDesc(a: BalanceCentsEntry, b: BalanceCentsEntry) {
  return b.cents - a.cents;
}

/**
 * Calculates each member's net balance and produces a simplified set of settlement
 * transactions that would settle the trip.
 *
 * What it does
 * - Aggregates all `expenses` to compute each member's net balance:
 *   - netBalance = totalPaid - totalOwed
 *   - positive => member should receive money (creditor)
 *   - negative => member owes money (debtor)
 * - Generates `settlements` using a greedy "Min Cash Flow"-style matcher:
 *   repeatedly match the largest remaining debtor with the largest remaining creditor.
 *
 * Input expectations
 * - `members` is the complete list of trip member user IDs.
 * - Every payer/share user_id must exist in `members`.
 * - Each expense must have at least one payer and at least one share.
 * - Amounts must be finite numbers and must be >= 0.
 *
 * Rounding strategy
 * - All calculations are performed in integer cents (rounded per input amount).
 * - If, after rounding, an expense's total paid differs from total owed by a few cents,
 *   the difference is applied to the largest share so the expense balances exactly.
 * - All output amounts are normalized to exactly 2 decimals.
 *
 * Output guarantees
 * - `settlements` amounts are strictly positive
 * - `settlements` never include self-payments (payer_id !== payee_id)
 * - zero-value transactions are excluded
 * - If the trip is already settled, `settlements` is an empty array
 *
 * Example
 * ```ts
 * const members = ["u1", "u2", "u3"];
 * const expenses = [
 *   {
 *     id: "e1",
 *     payers: [{ user_id: "u1", amount_paid: 60 }],
 *     shares: [
 *       { user_id: "u1", amount_owed: 20 },
 *       { user_id: "u2", amount_owed: 20 },
 *       { user_id: "u3", amount_owed: 20 },
 *     ],
 *   },
 * ];
 *
 * const result = calculateTripDebts(expenses, members);
 * // result.settlements ~= [
 * //   { payer_id: "u2", payee_id: "u1", amount: 20 },
 * //   { payer_id: "u3", payee_id: "u1", amount: 20 },
 * // ]
 * ```
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
    if (!expense.payers?.length) {
      throw new Error(`Expense ${expense.id} must have at least one payer.`);
    }
    if (!expense.shares?.length) {
      throw new Error(`Expense ${expense.id} must have at least one share.`);
    }

    const payerCentsByIndex: number[] = [];
    const shareCentsByIndex: number[] = [];

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
      payerCentsByIndex.push(toCents(payer.amount_paid));
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
      shareCentsByIndex.push(toCents(share.amount_owed));
    }

    const totalPaidCents = payerCentsByIndex.reduce((sum, v) => sum + v, 0);
    const totalOwedCents = shareCentsByIndex.reduce((sum, v) => sum + v, 0);
    const diffCents = totalPaidCents - totalOwedCents;

    // Rounding hardening: if payers and shares differ by a few cents due to rounding,
    // adjust the largest share by the difference so the expense balances exactly.
    if (diffCents !== 0) {
      let bestIndex = 0;
      for (let idx = 1; idx < shareCentsByIndex.length; idx++) {
        if (shareCentsByIndex[idx] > shareCentsByIndex[bestIndex]) bestIndex = idx;
      }

      const adjusted = shareCentsByIndex[bestIndex] + diffCents;
      if (adjusted < 0) {
        throw new Error(
          `Expense ${expense.id} cannot be balanced after rounding (diff=${fromCents(
            diffCents
          )}).`
        );
      }
      shareCentsByIndex[bestIndex] = adjusted;
    }

    for (let idx = 0; idx < expense.payers.length; idx++) {
      const payer = expense.payers[idx];
      const delta = payerCentsByIndex[idx];
      balanceCentsByUser.set(
        payer.user_id,
        (balanceCentsByUser.get(payer.user_id) ?? 0) + delta
      );
    }

    for (let idx = 0; idx < expense.shares.length; idx++) {
      const share = expense.shares[idx];
      const delta = shareCentsByIndex[idx];
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
      )}). Check that total paid equals total owed (rounding is applied to cents).`
    );
  }

  creditorCents.sort(sortByCentsDesc);
  debtorCents.sort(sortByCentsDesc);

  // Min Cash Flow-style greedy matching.
  // Each step fully settles either the current largest debtor or creditor,
  // ensuring no redundant (0-amount) transactions and preventing cycles.
  const settlements: SettlementTransaction[] = [];

  // Fully settled trip.
  if (debtorCents.length === 0 || creditorCents.length === 0) {
    return { netBalances, creditors, debtors, settlements };
  }

  let i = 0;
  let j = 0;

  while (i < debtorCents.length && j < creditorCents.length) {
    const debtor = debtorCents[i];
    const creditor = creditorCents[j];

    const transferCents = Math.min(debtor.cents, creditor.cents);

    if (transferCents > 0) {
      if (debtor.user_id === creditor.user_id) {
        throw new Error("Invalid settlement: self-payment would occur.");
      }

      // Debtor sends money to creditor.
      settlements.push({
        payer_id: debtor.user_id,
        payee_id: creditor.user_id,
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
