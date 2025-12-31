"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";

import MaterialCard from "@/components/ui/MaterialCard";

type MemberBalance = {
  user_id: string;
  name: string | null;
  email: string;
  paid: number;
  owed: number;
  net: number;
};

type ClientExpense = {
  id: string;
  description: string;
  date: string; // ISO string
  total_amount: number;
  payers: Array<{
    user_id: string;
    amount_paid: number;
    user: { name: string | null; email: string };
  }>;
  shares: Array<{
    user_id: string;
    amount_owed: number;
  }>;
};

type Settlement = {
  payer_id: string;
  payee_id: string;
  amount: number;
};

type Props = {
  members: MemberBalance[];
  expenses: ClientExpense[];
  settlements: Settlement[];
};

type TabKey = "overview" | "paid" | "owed" | "settlement";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function toCents(amount: number) {
  return Math.round((amount + Number.EPSILON) * 100);
}

function getSplitType(expense: ClientExpense): "equal" | "custom" {
  const cents = expense.shares.map((s) => toCents(s.amount_owed));
  const unique = new Set(cents);
  return unique.size <= 1 ? "equal" : "custom";
}

export default function MemberCardsWithDetail({ members, expenses, settlements }: Props) {
  const dialogTitleId = useId();

  const memberLabelById = useMemo(() => {
    return new Map(members.map((m) => [m.user_id, m.name?.trim() || m.email]));
  }, [members]);

  const [open, setOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("overview");

  const selected = useMemo(() => {
    if (!selectedUserId) return null;
    return members.find((m) => m.user_id === selectedUserId) ?? null;
  }, [members, selectedUserId]);

  const close = useCallback(() => {
    setOpen(false);
    setSelectedUserId(null);
    setTab("overview");
  }, []);

  const openFor = useCallback((userId: string) => {
    setSelectedUserId(userId);
    setTab("overview");
    setOpen(true);
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }

    if (!open) return;
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close, open]);

  const paidLog = useMemo(() => {
    if (!selectedUserId) return [];
    return expenses
      .map((e) => {
        const payer = e.payers.find((p) => p.user_id === selectedUserId);
        if (!payer) return null;
        return {
          expense_id: e.id,
          description: e.description,
          date: e.date,
          amount_paid: payer.amount_paid,
          total_amount: e.total_amount,
          payersLabel: e.payers.map((p) => p.user.name?.trim() || p.user.email).join(", "),
        };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x))
      .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  }, [expenses, selectedUserId]);

  const owedLog = useMemo(() => {
    if (!selectedUserId) return [];
    return expenses
      .map((e) => {
        const share = e.shares.find((s) => s.user_id === selectedUserId);
        if (!share) return null;
        return {
          expense_id: e.id,
          description: e.description,
          date: e.date,
          amount_owed: share.amount_owed,
          total_amount: e.total_amount,
          split_type: getSplitType(e),
        };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x))
      .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  }, [expenses, selectedUserId]);

  const netPerExpense = useMemo(() => {
    if (!selectedUserId) return [];

    const paidByExpense = new Map<string, number>();
    const owedByExpense = new Map<string, number>();

    for (const e of expenses) {
      const payer = e.payers.find((p) => p.user_id === selectedUserId);
      const share = e.shares.find((s) => s.user_id === selectedUserId);
      paidByExpense.set(e.id, payer ? payer.amount_paid : 0);
      owedByExpense.set(e.id, share ? share.amount_owed : 0);
    }

    return expenses
      .map((e) => {
        const paid = paidByExpense.get(e.id) ?? 0;
        const owed = owedByExpense.get(e.id) ?? 0;
        if (paid === 0 && owed === 0) return null;
        const net = Number((paid - owed).toFixed(2));
        return {
          expense_id: e.id,
          description: e.description,
          date: e.date,
          paid,
          owed,
          net,
        };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x))
      .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  }, [expenses, selectedUserId]);

  const settlementPreview = useMemo(() => {
    if (!selectedUserId) {
      return { pays: [] as Settlement[], gets: [] as Settlement[] };
    }

    return {
      pays: settlements.filter((s) => s.payer_id === selectedUserId),
      gets: settlements.filter((s) => s.payee_id === selectedUserId),
    };
  }, [selectedUserId, settlements]);

  return (
    <>
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {members.map((b) => {
          const isPositive = b.net > 0;
          const isNegative = b.net < 0;
          const netAbs = Math.abs(b.net);

          return (
            <button
              key={b.user_id}
              type="button"
              onClick={() => openFor(b.user_id)}
              className="w-full text-left"
              aria-haspopup="dialog"
            >
              <MaterialCard className="p-5 md:p-8">
                <div className="space-y-1">
                  <p className="text-sm font-semibold tracking-tight">{b.name ?? b.email}</p>
                  <p className="text-xs text-[#C4C7C5]">{b.email}</p>
                </div>

                <dl className="mt-4 grid grid-cols-3 gap-3">
                  <div>
                    <dt className="text-xs text-[#C4C7C5]">Paid</dt>
                    <dd className="text-sm font-medium tabular-nums">{formatCurrency(b.paid)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[#C4C7C5]">Owed</dt>
                    <dd className="text-sm font-medium tabular-nums">{formatCurrency(b.owed)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[#C4C7C5]">Net</dt>
                    <dd
                      className={
                        "text-sm font-semibold tabular-nums " +
                        (isPositive
                          ? "text-green-400"
                          : isNegative
                            ? "text-red-400"
                            : "text-[#C4C7C5]")
                      }
                    >
                      {formatCurrency(b.net)}
                    </dd>
                  </div>
                </dl>

                <p
                  className={
                    "mt-3 text-sm font-medium " +
                    (isPositive
                      ? "text-green-400"
                      : isNegative
                        ? "text-red-400"
                        : "text-[#C4C7C5]")
                  }
                >
                  {isPositive
                    ? `Gets back ${formatCurrency(netAbs)}`
                    : isNegative
                      ? `Owes ${formatCurrency(netAbs)}`
                      : "Settled"}
                </p>
              </MaterialCard>
            </button>
          );
        })}
      </div>

      {open && selected ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={dialogTitleId}
          className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4"
        >
          <button
            type="button"
            onClick={close}
            className="absolute inset-0 bg-black/40"
            aria-label="Close"
          />

          <div className="relative h-full w-full overflow-auto border border-black/8 bg-white p-5 dark:border-white/[.145] dark:bg-black sm:h-auto sm:max-h-[85vh] sm:max-w-2xl sm:rounded-xl">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <h2 id={dialogTitleId} className="text-lg font-semibold tracking-tight">
                  {selected.name?.trim() || selected.email}
                </h2>
                <p className="text-sm text-black/60 dark:text-zinc-400">{selected.email}</p>
              </div>

              <button
                type="button"
                onClick={close}
                className="rounded-md px-2 py-1 text-sm text-black/60 hover:text-black dark:text-zinc-400 dark:hover:text-zinc-50"
              >
                Close
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {(
                [
                  ["overview", "Overview"],
                  ["paid", "Paid"],
                  ["owed", "Owed"],
                  ["settlement", "Settlement"],
                ] as Array<[TabKey, string]>
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={
                    "inline-flex h-9 items-center justify-center rounded-full border px-4 text-sm font-medium transition-colors " +
                    (tab === key
                      ? "border-black/15 bg-black/5 text-black dark:border-white/20 dark:bg-white/10 dark:text-zinc-50"
                      : "border-black/8 text-black/70 hover:bg-black/4 dark:border-white/[.145] dark:text-zinc-300 dark:hover:bg-white/10")
                  }
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === "overview" ? (
              <div className="mt-5 space-y-4">
                <div className="rounded-lg border border-black/8 p-4 dark:border-white/[.145]">
                  <p className="text-sm font-medium text-black/80 dark:text-zinc-200">Overview</p>
                  <dl className="mt-3 grid grid-cols-3 gap-3">
                    <div>
                      <dt className="text-xs text-black/60 dark:text-zinc-400">Total Paid</dt>
                      <dd className="text-sm font-semibold tabular-nums">{formatCurrency(selected.paid)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-black/60 dark:text-zinc-400">Total Owed</dt>
                      <dd className="text-sm font-semibold tabular-nums">{formatCurrency(selected.owed)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-black/60 dark:text-zinc-400">Net Balance</dt>
                      <dd className="text-sm font-semibold tabular-nums">{formatCurrency(selected.net)}</dd>
                    </div>
                  </dl>

                  <p className="mt-3 text-sm text-black/70 dark:text-zinc-300">
                    {selected.net > 0
                      ? `Settlement Status: Gets back ${formatCurrency(Math.abs(selected.net))}`
                      : selected.net < 0
                        ? `Settlement Status: Owes ${formatCurrency(Math.abs(selected.net))}`
                        : "Settlement Status: Settled"}
                  </p>
                </div>

                <div className="rounded-lg border border-black/8 p-4 dark:border-white/[.145]">
                  <p className="text-sm font-medium text-black/80 dark:text-zinc-200">Net effect per expense</p>
                  {netPerExpense.length === 0 ? (
                    <p className="mt-2 text-sm text-black/60 dark:text-zinc-400">No activity yet.</p>
                  ) : (
                    <ul className="mt-3 divide-y divide-black/10 dark:divide-white/[.145]">
                      {netPerExpense.map((row) => {
                        const isPositive = row.net > 0;
                        const isNegative = row.net < 0;
                        return (
                          <li key={row.expense_id} className="py-2">
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">{row.description}</p>
                                <p className="text-xs text-black/50 dark:text-zinc-400">{formatDate(row.date)}</p>
                              </div>
                              <div className="text-right">
                                <p
                                  className={
                                    "text-sm font-semibold tabular-nums " +
                                    (isPositive
                                      ? "text-green-600 dark:text-green-400"
                                      : isNegative
                                        ? "text-red-600 dark:text-red-400"
                                        : "text-black/70 dark:text-zinc-300")
                                  }
                                >
                                  {formatCurrency(row.net)}
                                </p>
                                <p className="text-xs text-black/50 dark:text-zinc-400">
                                  Paid {formatCurrency(row.paid)} · Owed {formatCurrency(row.owed)}
                                </p>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            ) : null}

            {tab === "paid" ? (
              <div className="mt-5 rounded-lg border border-black/8 p-4 dark:border-white/[.145]">
                <p className="text-sm font-medium text-black/80 dark:text-zinc-200">Paid expenses</p>
                {paidLog.length === 0 ? (
                  <p className="mt-2 text-sm text-black/60 dark:text-zinc-400">No paid expenses yet.</p>
                ) : (
                  <ul className="mt-3 divide-y divide-black/10 dark:divide-white/[.145]">
                    {paidLog.map((row) => (
                      <li key={row.expense_id} className="py-2">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{row.description}</p>
                            <p className="text-xs text-black/50 dark:text-zinc-400">{formatDate(row.date)}</p>
                            {row.payersLabel ? (
                              <p className="mt-1 text-xs text-black/60 dark:text-zinc-400">
                                Payers: {row.payersLabel}
                              </p>
                            ) : null}
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold tabular-nums">{formatCurrency(row.amount_paid)}</p>
                            <p className="text-xs text-black/50 dark:text-zinc-400">
                              Total {formatCurrency(row.total_amount)}
                            </p>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}

            {tab === "owed" ? (
              <div className="mt-5 rounded-lg border border-black/8 p-4 dark:border-white/[.145]">
                <p className="text-sm font-medium text-black/80 dark:text-zinc-200">Owed expenses</p>
                {owedLog.length === 0 ? (
                  <p className="mt-2 text-sm text-black/60 dark:text-zinc-400">No owed expenses yet.</p>
                ) : (
                  <ul className="mt-3 divide-y divide-black/10 dark:divide-white/[.145]">
                    {owedLog.map((row) => (
                      <li key={row.expense_id} className="py-2">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{row.description}</p>
                            <p className="text-xs text-black/50 dark:text-zinc-400">{formatDate(row.date)}</p>
                            <p className="mt-1 text-xs text-black/60 dark:text-zinc-400">
                              Split type: {row.split_type}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold tabular-nums">{formatCurrency(row.amount_owed)}</p>
                            <p className="text-xs text-black/50 dark:text-zinc-400">
                              Total {formatCurrency(row.total_amount)}
                            </p>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}

            {tab === "settlement" ? (
              <div className="mt-5 space-y-4">
                <div className="rounded-lg border border-black/8 p-4 dark:border-white/[.145]">
                  <p className="text-sm font-medium text-black/80 dark:text-zinc-200">
                    Who this member needs to pay
                  </p>
                  {settlementPreview.pays.length === 0 ? (
                    <p className="mt-2 text-sm text-black/60 dark:text-zinc-400">No payments needed.</p>
                  ) : (
                    <ul className="mt-3 divide-y divide-black/10 dark:divide-white/[.145]">
                      {settlementPreview.pays.map((s, idx) => {
                        const payee = memberLabelById.get(s.payee_id) ?? "Unknown member";
                        return (
                          <li key={`${s.payer_id}-${s.payee_id}-${idx}`} className="flex items-center justify-between gap-4 py-2">
                            <p className="text-sm">
                              Pays <span className="font-medium">{payee}</span>
                            </p>
                            <p className="text-sm font-medium tabular-nums">{formatCurrency(s.amount)}</p>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                <div className="rounded-lg border border-black/8 p-4 dark:border-white/[.145]">
                  <p className="text-sm font-medium text-black/80 dark:text-zinc-200">
                    Who needs to pay this member
                  </p>
                  {settlementPreview.gets.length === 0 ? (
                    <p className="mt-2 text-sm text-black/60 dark:text-zinc-400">No one owes them in the settlement plan.</p>
                  ) : (
                    <ul className="mt-3 divide-y divide-black/10 dark:divide-white/[.145]">
                      {settlementPreview.gets.map((s, idx) => {
                        const payer = memberLabelById.get(s.payer_id) ?? "Unknown member";
                        return (
                          <li key={`${s.payer_id}-${s.payee_id}-${idx}`} className="flex items-center justify-between gap-4 py-2">
                            <p className="text-sm">
                              <span className="font-medium">{payer}</span> pays
                            </p>
                            <p className="text-sm font-medium tabular-nums">{formatCurrency(s.amount)}</p>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
