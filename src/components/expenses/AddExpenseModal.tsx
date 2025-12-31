"use client";

import type { ReactNode } from "react";
import { useActionState, useCallback, useEffect, useId, useMemo, useState } from "react";

import { createExpense } from "@/app/_actions/expenses";
import MaterialButton from "@/components/ui/MaterialButton";

type Props = {
  tripId: string;
  currentUserId: string;
  members: Array<{ id: string; name: string | null; email: string }>;
  triggerLabel?: ReactNode;
  triggerVariant?: "filled" | "tonal" | "text";
  triggerFab?: boolean;
  triggerClassName?: string;
};

const initialState = { ok: false as const, message: undefined as string | undefined };

type SplitMode = "equal" | "custom" | "percent";

function toCents(amount: number) {
  return Math.round((amount + Number.EPSILON) * 100);
}

function fromCents(cents: number) {
  return Number((cents / 100).toFixed(2));
}

function parseMoney(value: string): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return n;
}

function splitCentsEqually(totalCents: number, userIds: string[]) {
  const base = Math.floor(totalCents / userIds.length);
  const remainder = totalCents - base * userIds.length;
  return userIds.map((userId, idx) => ({
    user_id: userId,
    cents: base + (idx < remainder ? 1 : 0),
  }));
}

function splitCentsByPercents(totalCents: number, items: Array<{ user_id: string; percent: number }>) {
  const normalized = items.filter((i) => Number.isFinite(i.percent) && i.percent > 0);
  const totalPercent = normalized.reduce((s, i) => s + i.percent, 0);
  if (normalized.length === 0 || Math.abs(totalPercent - 100) > 1e-6) {
    return null;
  }

  const bases: Array<{ user_id: string; cents: number; frac: number }> = normalized.map((i) => {
    const raw = (totalCents * i.percent) / 100;
    const floored = Math.floor(raw);
    return { user_id: i.user_id, cents: floored, frac: raw - floored };
  });

  let remaining = totalCents - bases.reduce((s, b) => s + b.cents, 0);
  bases.sort((a, b) => b.frac - a.frac);
  for (let i = 0; i < bases.length && remaining > 0; i++) {
    bases[i] = { ...bases[i], cents: bases[i].cents + 1 };
    remaining -= 1;
  }

  return bases.map((b) => ({ user_id: b.user_id, cents: b.cents }));
}

export function AddExpenseModal({
  tripId,
  members,
  currentUserId,
  triggerLabel,
  triggerVariant,
  triggerFab,
  triggerClassName,
}: Props) {
  const [open, setOpen] = useState(false);
  const dialogTitleId = useId();

  const [state, formAction, pending] = useActionState(createExpense, initialState);

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");

  const [splitMode, setSplitMode] = useState<SplitMode>("equal");
  const [payerAmounts, setPayerAmounts] = useState<Record<string, string>>({});
  const [customShareAmounts, setCustomShareAmounts] = useState<Record<string, string>>({});
  const [percentShares, setPercentShares] = useState<Record<string, string>>({});

  const memberIds = useMemo(() => members.map((m) => m.id), [members]);

  const close = useCallback(() => setOpen(false), []);
  const openModal = useCallback(() => {
    setDescription("");
    setAmount("");
    setDate("");
    setSplitMode("equal");

    const nextPayers: Record<string, string> = {};
    const nextCustom: Record<string, string> = {};
    const nextPercents: Record<string, string> = {};
    const defaultPercent = members.length > 0 ? (100 / members.length).toFixed(2) : "0";

    for (const m of members) {
      nextPayers[m.id] = m.id === currentUserId ? "" : "0";
      nextCustom[m.id] = "0";
      nextPercents[m.id] = defaultPercent;
    }

    setPayerAmounts(nextPayers);
    setCustomShareAmounts(nextCustom);
    setPercentShares(nextPercents);
    setOpen(true);
  }, [currentUserId, members]);

  const payloadComputation = useMemo(() => {
    const desc = description.trim();
    const total = parseMoney(amount);
    const totalCents = toCents(total);

    if (!desc) return { ok: false as const, message: "Description is required." };
    if (!Number.isFinite(total) || total <= 0) {
      return { ok: false as const, message: "Amount must be greater than 0." };
    }
    if (!date) return { ok: false as const, message: "Date is required." };

    const dateIso = `${date}T00:00:00.000Z`;

    const payerCents = members.map((m) => ({
      user_id: m.id,
      cents: toCents(parseMoney(payerAmounts[m.id] ?? "0")),
    }));
    const paidSum = payerCents.reduce((s, p) => s + p.cents, 0);
    if (paidSum !== totalCents) {
      return {
        ok: false as const,
        message: "Sum of payer amounts must equal total amount.",
      };
    }

    const payers = payerCents
      .filter((p) => p.cents > 0)
      .map((p) => ({ user_id: p.user_id, amount_paid: fromCents(p.cents) }));
    if (payers.length === 0) {
      return { ok: false as const, message: "At least one payer is required." };
    }

    let shareCents: Array<{ user_id: string; cents: number }> | null = null;

    if (splitMode === "equal") {
      shareCents = splitCentsEqually(totalCents, memberIds);
    } else if (splitMode === "custom") {
      const entries = members.map((m) => ({
        user_id: m.id,
        cents: toCents(parseMoney(customShareAmounts[m.id] ?? "0")),
      }));
      const sum = entries.reduce((s, e) => s + e.cents, 0);
      if (sum !== totalCents) {
        return {
          ok: false as const,
          message: "Sum of owed amounts must equal total amount.",
        };
      }
      shareCents = entries;
    } else if (splitMode === "percent") {
      const entries = members.map((m) => ({
        user_id: m.id,
        percent: parseMoney(percentShares[m.id] ?? "0"),
      }));

      const computed = splitCentsByPercents(totalCents, entries);
      if (!computed) {
        return {
          ok: false as const,
          message: "Percent shares must sum to 100%.",
        };
      }
      shareCents = computed;
    }

    if (!shareCents) {
      return { ok: false as const, message: "Invalid split configuration." };
    }

    const owedSum = shareCents.reduce((s, e) => s + e.cents, 0);
    if (owedSum !== totalCents) {
      return {
        ok: false as const,
        message: "Sum of shares must equal total amount.",
      };
    }

    const shares = shareCents
      .filter((s) => s.cents > 0)
      .map((s) => ({ user_id: s.user_id, amount_owed: fromCents(s.cents) }));
    if (shares.length === 0) {
      return { ok: false as const, message: "At least one share is required." };
    }

    return {
      ok: true as const,
      payload: JSON.stringify({
        trip_id: tripId,
        description: desc,
        total_amount: fromCents(totalCents),
        date: dateIso,
        payers,
        shares,
      }),
    };
  }, [amount, customShareAmounts, date, description, memberIds, members, payerAmounts, percentShares, splitMode, tripId]);

  useEffect(() => {
    if (state.ok) {
      queueMicrotask(close);
    }
  }, [close, state.ok]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }

    if (open) {
      window.addEventListener("keydown", onKeyDown);
      return () => window.removeEventListener("keydown", onKeyDown);
    }

    return;
  }, [close, open]);

  return (
    <>
      <MaterialButton
        variant={triggerVariant ?? "filled"}
        fab={triggerFab ?? false}
        onClick={openModal}
        className={triggerClassName}
      >
        {triggerLabel ?? "Add Expense"}
      </MaterialButton>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={dialogTitleId}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <button
            type="button"
            onClick={close}
            className="absolute inset-0 bg-black/40"
            aria-label="Close"
          />

          <div className="relative w-full max-w-lg rounded-xl border border-black/8 bg-white p-5 dark:border-white/[.145] dark:bg-black">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <h2 id={dialogTitleId} className="text-lg font-semibold tracking-tight">
                  Add expense
                </h2>
                <p className="text-sm text-black/60 dark:text-zinc-400">
                  Multi-payer expenses with flexible splits.
                </p>
              </div>

              <button
                type="button"
                onClick={close}
                className="rounded-md px-2 py-1 text-sm text-black/60 hover:text-black dark:text-zinc-400 dark:hover:text-zinc-50"
              >
                Close
              </button>
            </div>

            <form action={formAction} className="mt-4 grid gap-3">
              <input type="hidden" name="tripId" value={tripId} />

              <input
                type="hidden"
                name="payload"
                value={payloadComputation.ok ? payloadComputation.payload : ""}
              />

              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-black/80 dark:text-zinc-200">
                  Description
                </span>
                <input
                  name="description"
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="h-11 rounded-lg border border-black/8 bg-transparent px-3 text-black outline-none dark:border-white/[.145] dark:text-zinc-50"
                  placeholder="e.g., Lunch"
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-black/80 dark:text-zinc-200">
                    Amount
                  </span>
                  <input
                    name="amount"
                    type="number"
                    required
                    min={0.01}
                    step={0.01}
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => {
                      const nextAmount = e.target.value;
                      setAmount(nextAmount);

                      // If payers look untouched (all 0/empty), default the current user to the total.
                      setPayerAmounts((prev) => {
                        const values = Object.values(prev);
                        const looksUntouched =
                          values.length === 0 ||
                          values.every((v) => {
                            const n = parseMoney(v);
                            return !Number.isFinite(n) || n === 0;
                          });

                        if (!looksUntouched) return prev;

                        const next: Record<string, string> = { ...prev };
                        for (const m of members) {
                          next[m.id] = m.id === currentUserId ? nextAmount : "0";
                        }
                        return next;
                      });
                    }}
                    className="h-11 rounded-lg border border-black/8 bg-transparent px-3 text-black outline-none dark:border-white/[.145] dark:text-zinc-50"
                    placeholder="50.00"
                  />
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-black/80 dark:text-zinc-200">
                    Date
                  </span>
                  <input
                    name="date"
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="h-11 rounded-lg border border-black/8 bg-transparent px-3 text-black outline-none dark:border-white/[.145] dark:text-zinc-50"
                  />
                </label>
              </div>

              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-black/80 dark:text-zinc-200">
                  Split mode
                </span>
                <select
                  value={splitMode}
                  onChange={(e) => setSplitMode(e.target.value as SplitMode)}
                  className="h-11 rounded-lg border border-black/8 bg-transparent px-3 text-black outline-none dark:border-white/[.145] dark:text-zinc-50"
                >
                  <option value="equal">Equal split</option>
                  <option value="custom">Custom amounts</option>
                  <option value="percent">Percentages</option>
                </select>
              </label>

              <div className="rounded-lg border border-black/8 p-3 dark:border-white/[.145]">
                <p className="text-sm font-medium text-black/80 dark:text-zinc-200">Payers</p>
                <p className="mt-0.5 text-xs text-black/60 dark:text-zinc-400">
                  Enter how much each person paid (can be split across multiple payers).
                </p>

                <div className="mt-3 grid gap-2">
                  {members.map((m) => (
                    <div key={m.id} className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm">{m.name?.trim() ? m.name : m.email}</p>
                        <p className="truncate text-xs text-black/60 dark:text-zinc-400">{m.email}</p>
                      </div>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        inputMode="decimal"
                        value={payerAmounts[m.id] ?? "0"}
                        onChange={(e) =>
                          setPayerAmounts((prev) => ({ ...prev, [m.id]: e.target.value }))
                        }
                        className="h-10 w-28 rounded-lg border border-black/8 bg-transparent px-3 text-right text-sm tabular-nums text-black outline-none dark:border-white/[.145] dark:text-zinc-50"
                        aria-label={`Amount paid by ${m.email}`}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {!payloadComputation.ok ? (
                <p className="text-sm text-red-700 dark:text-red-400">
                  {payloadComputation.message}
                </p>
              ) : null}

              <div className="rounded-lg border border-black/8 p-3 dark:border-white/[.145]">
                <p className="text-sm font-medium text-black/80 dark:text-zinc-200">Shares</p>
                <p className="mt-0.5 text-xs text-black/60 dark:text-zinc-400">
                  Define how the total should be split.
                </p>

                {splitMode === "equal" ? (
                  <p className="mt-3 text-sm text-black/70 dark:text-zinc-300">
                    Split equally among all members.
                  </p>
                ) : null}

                {splitMode === "custom" ? (
                  <div className="mt-3 grid gap-2">
                    {members.map((m) => (
                      <div key={m.id} className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm">{m.name?.trim() ? m.name : m.email}</p>
                          <p className="truncate text-xs text-black/60 dark:text-zinc-400">{m.email}</p>
                        </div>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          inputMode="decimal"
                          value={customShareAmounts[m.id] ?? "0"}
                          onChange={(e) =>
                            setCustomShareAmounts((prev) => ({ ...prev, [m.id]: e.target.value }))
                          }
                          className="h-10 w-28 rounded-lg border border-black/8 bg-transparent px-3 text-right text-sm tabular-nums text-black outline-none dark:border-white/[.145] dark:text-zinc-50"
                          aria-label={`Amount owed by ${m.email}`}
                        />
                      </div>
                    ))}
                  </div>
                ) : null}

                {splitMode === "percent" ? (
                  <div className="mt-3 grid gap-2">
                    {members.map((m) => (
                      <div key={m.id} className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm">{m.name?.trim() ? m.name : m.email}</p>
                          <p className="truncate text-xs text-black/60 dark:text-zinc-400">{m.email}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            inputMode="decimal"
                            value={percentShares[m.id] ?? "0"}
                            onChange={(e) =>
                              setPercentShares((prev) => ({ ...prev, [m.id]: e.target.value }))
                            }
                            className="h-10 w-28 rounded-lg border border-black/8 bg-transparent px-3 text-right text-sm tabular-nums text-black outline-none dark:border-white/[.145] dark:text-zinc-50"
                            aria-label={`Percent owed by ${m.email}`}
                          />
                          <span className="text-sm text-black/60 dark:text-zinc-400">%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              {state.message ? (
                <p className="text-sm text-red-700 dark:text-red-400">
                  {state.message}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={pending || !payloadComputation.ok}
                className="mt-1 inline-flex h-11 w-full items-center justify-center rounded-full border border-black/8 px-5 text-sm font-medium transition-colors hover:bg-black/4 disabled:opacity-60 dark:border-white/[.145] dark:hover:bg-white/10"
              >
                {pending ? "Adding…" : "Add expense"}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default AddExpenseModal;
