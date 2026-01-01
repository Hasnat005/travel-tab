"use client";

import type { ReactNode } from "react";
import { useActionState, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

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

function todayDateInputValue(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function buildEqualPercents(memberIds: string[]): Record<string, string> {
  if (memberIds.length === 0) return {};

  // Use 2-decimal fixed units that sum to exactly 100.00
  const totalUnits = 10000;
  const base = Math.floor(totalUnits / memberIds.length);
  const remainder = totalUnits - base * memberIds.length;

  const result: Record<string, string> = {};
  for (let index = 0; index < memberIds.length; index++) {
    const units = base + (index < remainder ? 1 : 0);
    result[memberIds[index]!] = (units / 100).toFixed(2);
  }
  return result;
}

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

function formatCurrency(amount: number, currency = "USD") {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
  } catch {
    const sign = amount < 0 ? "-" : "";
    return `${sign}$${Math.abs(amount).toFixed(2)}`;
  }
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

  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [touched, setTouched] = useState({ description: false, amount: false, date: false });

  const [splitMode, setSplitMode] = useState<SplitMode>("equal");
  const [payerAmounts, setPayerAmounts] = useState<Record<string, string>>({});
  const [customShareAmounts, setCustomShareAmounts] = useState<Record<string, string>>({});
  const [percentShares, setPercentShares] = useState<Record<string, string>>({});

  const memberIds = useMemo(() => members.map((m) => m.id), [members]);

  const [initialSnapshot, setInitialSnapshot] = useState<string>("");
  const stableRecordString = useCallback((record: Record<string, string>) => {
    return Object.keys(record)
      .sort()
      .map((k) => `${k}:${record[k] ?? ""}`)
      .join("|");
  }, []);

  const currentSnapshot = useMemo(() => {
    return [
      `d:${description}`,
      `a:${amount}`,
      `dt:${date}`,
      `m:${splitMode}`,
      `p:${stableRecordString(payerAmounts)}`,
      `c:${stableRecordString(customShareAmounts)}`,
      `pc:${stableRecordString(percentShares)}`,
    ].join("\n");
  }, [amount, customShareAmounts, date, description, payerAmounts, percentShares, splitMode, stableRecordString]);

  const isDirty = open && initialSnapshot !== "" && currentSnapshot !== initialSnapshot;

  const close = useCallback(() => setOpen(false), []);
  const requestClose = useCallback(() => {
    if (isDirty && !pending) {
      const okToClose = window.confirm("Discard this expense? Your changes will be lost.");
      if (!okToClose) return;
    }

    setOpen(false);
  }, [isDirty, pending]);

  const openModal = useCallback(() => {
    setDescription("");
    setAmount("");
    setDate(todayDateInputValue());
    setSplitMode("equal");
    setSubmitAttempted(false);
    setTouched({ description: false, amount: false, date: false });

    const nextPayers: Record<string, string> = {};
    const nextCustom: Record<string, string> = {};
    const nextPercents: Record<string, string> = {};

    const percentDefaults = buildEqualPercents(members.map((m) => m.id));

    for (const m of members) {
      nextPayers[m.id] = m.id === currentUserId ? "" : "0";
      nextCustom[m.id] = "0";
      nextPercents[m.id] = percentDefaults[m.id] ?? "0";
    }

    setPayerAmounts(nextPayers);
    setCustomShareAmounts(nextCustom);
    setPercentShares(nextPercents);

    setInitialSnapshot(
      [
        `d:`,
        `a:`,
        `dt:${todayDateInputValue()}`,
        `m:equal`,
        `p:${stableRecordString(nextPayers)}`,
        `c:${stableRecordString(nextCustom)}`,
        `pc:${stableRecordString(nextPercents)}`,
      ].join("\n")
    );

    setOpen(true);
  }, [currentUserId, members, stableRecordString]);

  const totals = useMemo(() => {
    const total = parseMoney(amount);
    const totalCents = Number.isFinite(total) && total > 0 ? toCents(total) : 0;

    const payerCents = members.map((m) => ({
      user_id: m.id,
      cents: toCents(parseMoney(payerAmounts[m.id] ?? "0")),
    }));
    const paidSumCents = payerCents.reduce((s, p) => s + p.cents, 0);

    let shareCents: Array<{ user_id: string; cents: number }> | null = null;
    let percentSum = 0;

    if (totalCents > 0 && memberIds.length > 0) {
      if (splitMode === "equal") {
        shareCents = splitCentsEqually(totalCents, memberIds);
      } else if (splitMode === "custom") {
        shareCents = members.map((m) => ({
          user_id: m.id,
          cents: toCents(parseMoney(customShareAmounts[m.id] ?? "0")),
        }));
      } else if (splitMode === "percent") {
        const percentEntries = members.map((m) => ({
          user_id: m.id,
          percent: parseMoney(percentShares[m.id] ?? "0"),
        }));
        percentSum = percentEntries.reduce((s, e) => s + (Number.isFinite(e.percent) ? e.percent : 0), 0);
        shareCents = splitCentsByPercents(totalCents, percentEntries);
      }
    }

    const owedSumCents = shareCents?.reduce((s, e) => s + e.cents, 0) ?? 0;

    return {
      total,
      totalCents,
      payerCents,
      paidSumCents,
      owedSumCents,
      percentSum,
      shareCents,
    };
  }, [amount, customShareAmounts, memberIds, members, payerAmounts, percentShares, splitMode]);

  const topFieldErrors = useMemo(() => {
    const desc = description.trim();
    const total = parseMoney(amount);

    const showDesc = submitAttempted || touched.description;
    const showAmount = submitAttempted || touched.amount;
    const showDate = submitAttempted || touched.date;

    return {
      description: showDesc && !desc ? "Description is required." : null,
      amount:
        showAmount && (!Number.isFinite(total) || total <= 0) ? "Amount must be greater than 0." : null,
      date: showDate && !date ? "Date is required." : null,
    };
  }, [amount, date, description, submitAttempted, touched.amount, touched.date, touched.description]);

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

  const prevPendingRef = useRef(false);
  useEffect(() => {
    const wasPending = prevPendingRef.current;
    prevPendingRef.current = pending;

    // Only react when a submission just finished.
    if (!open || !wasPending || pending) return;

    if (state.ok) {
      toast.success("Expense added");
      queueMicrotask(close);
      return;
    }

    if (state.message) {
      toast.error(state.message);
    }
  }, [close, open, pending, state.message, state.ok]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") requestClose();
    }

    if (open) {
      window.addEventListener("keydown", onKeyDown);
      return () => window.removeEventListener("keydown", onKeyDown);
    }

    return;
  }, [open, requestClose]);

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
            onClick={requestClose}
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
                onClick={requestClose}
                className="rounded-md px-2 py-1 text-sm text-black/60 hover:text-black dark:text-zinc-400 dark:hover:text-zinc-50"
              >
                Close
              </button>
            </div>

            <form action={formAction} className="mt-4 flex max-h-[78vh] flex-col" onSubmit={() => setSubmitAttempted(true)}>
              <input type="hidden" name="tripId" value={tripId} />

              <input
                type="hidden"
                name="payload"
                value={payloadComputation.ok ? payloadComputation.payload : ""}
              />

              <div className="grid gap-3 overflow-y-auto pr-1">
              <div className="space-y-1">
                <p className="text-sm font-medium text-black/80 dark:text-zinc-200">Expense info</p>
                <p className="text-xs text-black/60 dark:text-zinc-400">What was it and how much?</p>
              </div>

              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-black/80 dark:text-zinc-200">
                  Description
                </span>
                <input
                  name="description"
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, description: true }))}
                  className="h-11 rounded-lg border border-black/8 bg-transparent px-3 text-black outline-none dark:border-white/[.145] dark:text-zinc-50"
                  placeholder="e.g., Lunch"
                />
                {topFieldErrors.description ? (
                  <span className="text-xs text-red-700 dark:text-red-400">{topFieldErrors.description}</span>
                ) : null}
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
                    onBlur={() => setTouched((t) => ({ ...t, amount: true }))}
                    className="h-11 rounded-lg border border-black/8 bg-transparent px-3 text-black outline-none dark:border-white/[.145] dark:text-zinc-50"
                    placeholder="50.00"
                  />
                  {topFieldErrors.amount ? (
                    <span className="text-xs text-red-700 dark:text-red-400">{topFieldErrors.amount}</span>
                  ) : null}
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
                    onBlur={() => setTouched((t) => ({ ...t, date: true }))}
                    className="h-11 rounded-lg border border-black/8 bg-transparent px-3 text-black outline-none dark:border-white/[.145] dark:text-zinc-50"
                  />
                  {topFieldErrors.date ? (
                    <span className="text-xs text-red-700 dark:text-red-400">{topFieldErrors.date}</span>
                  ) : null}
                </label>
              </div>

              <div className="space-y-1">
                <p className="text-sm font-medium text-black/80 dark:text-zinc-200">Split</p>
                <p className="text-xs text-black/60 dark:text-zinc-400">How should this be shared?</p>

                <div role="radiogroup" aria-label="Split mode" className="grid grid-cols-3 gap-2">
                  {([
                    { key: "equal" as const, label: "Equal" },
                    { key: "custom" as const, label: "Amounts" },
                    { key: "percent" as const, label: "%" },
                  ] satisfies Array<{ key: SplitMode; label: string }>).map((item) => {
                    const selected = splitMode === item.key;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setSplitMode(item.key)}
                        className={
                          "h-11 rounded-lg border px-3 text-sm font-medium transition-colors " +
                          (selected
                            ? "border-black/15 bg-black/4 text-black dark:border-white/20 dark:bg-white/10 dark:text-zinc-50"
                            : "border-black/8 bg-transparent text-black/80 hover:bg-black/4 dark:border-white/[.145] dark:text-zinc-200 dark:hover:bg-white/10")
                        }
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>

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

                <div className="mt-3 flex items-center justify-between gap-3 text-xs text-black/60 dark:text-zinc-400">
                  <span>
                    Paid {formatCurrency(fromCents(totals.paidSumCents))} of {formatCurrency(fromCents(totals.totalCents))}
                  </span>
                  <span className="tabular-nums">
                    {totals.totalCents - totals.paidSumCents === 0
                      ? "✓"
                      : `${totals.totalCents - totals.paidSumCents > 0 ? "Remaining" : "Over"} ${formatCurrency(
                          fromCents(Math.abs(totals.totalCents - totals.paidSumCents))
                        )}`}
                  </span>
                </div>

                <div className="mt-3 grid gap-1">
                  {members.map((m) => {
                    const paidCents = totals.payerCents.find((p) => p.user_id === m.id)?.cents ?? 0;
                    return (
                      <div key={m.id} className="flex items-center justify-between gap-3 text-xs">
                        <span className="truncate text-black/70 dark:text-zinc-300">
                          {m.name?.trim() ? m.name : m.email}
                        </span>
                        <span className="tabular-nums text-black/60 dark:text-zinc-400">
                          {formatCurrency(fromCents(paidCents))}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

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

                <div className="mt-3 flex items-center justify-between gap-3 text-xs text-black/60 dark:text-zinc-400">
                  <span>
                    Owed {formatCurrency(fromCents(totals.owedSumCents))} of {formatCurrency(fromCents(totals.totalCents))}
                  </span>
                  <span className="tabular-nums">
                    {splitMode === "percent" ? `Percent total ${totals.percentSum.toFixed(2)}%` : null}
                  </span>
                </div>

                {totals.shareCents ? (
                  <div className="mt-3 grid gap-1">
                    {members.map((m) => {
                      const owedCents = totals.shareCents?.find((s) => s.user_id === m.id)?.cents ?? 0;
                      return (
                        <div key={m.id} className="flex items-center justify-between gap-3 text-xs">
                          <span className="truncate text-black/70 dark:text-zinc-300">
                            {m.name?.trim() ? m.name : m.email}
                          </span>
                          <span className="tabular-nums text-black/60 dark:text-zinc-400">
                            {formatCurrency(fromCents(owedCents))}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>

              </div>

              <div className="sticky bottom-0 mt-3 border-t border-black/8 bg-white pt-3 dark:border-white/[.145] dark:bg-black">
                {totals.totalCents > 0 ? (
                  <div className="mb-2 rounded-lg border border-black/8 p-3 text-xs text-black/60 dark:border-white/[.145] dark:text-zinc-400">
                    <p className="font-medium text-black/80 dark:text-zinc-200">Summary</p>
                    <p className="mt-1">
                      Total {formatCurrency(fromCents(totals.totalCents))} · Paid {formatCurrency(fromCents(totals.paidSumCents))} · Owed {formatCurrency(fromCents(totals.owedSumCents))}
                    </p>
                  </div>
                ) : null}

                {!payloadComputation.ok ? (
                  submitAttempted || isDirty ? (
                    <p className="mb-2 text-sm text-red-700 dark:text-red-400">{payloadComputation.message}</p>
                  ) : null
                ) : null}

                {state.message ? (
                  <p className="mb-2 text-sm text-red-700 dark:text-red-400">{state.message}</p>
                ) : null}

                <button
                  type="submit"
                  disabled={pending || !payloadComputation.ok}
                  className="inline-flex h-11 w-full items-center justify-center rounded-full border border-black/8 px-5 text-sm font-medium transition-colors hover:bg-black/4 disabled:opacity-60 dark:border-white/[.145] dark:hover:bg-white/10"
                >
                  {pending ? "Adding…" : "Add expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default AddExpenseModal;
