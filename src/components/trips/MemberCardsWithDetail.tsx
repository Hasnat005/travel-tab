"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";

import MaterialCard from "@/components/ui/MaterialCard";

type MemberBalance = {
  user_id: string;
  username?: string | null;
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
    user: { name: string | null; email: string; username?: string | null };
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
    return new Map(
      members.map((m) => [m.user_id, m.username?.trim() || m.name?.trim() || m.email])
    );
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
          payersLabel: e.payers
            .map((p) => p.user.username?.trim() || p.user.name?.trim() || p.user.email)
            .join(", "),
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
              const label = b.username?.trim() || b.name?.trim() || b.email;
          const letter = (label.trim()?.[0] ?? "U").toUpperCase();

          return (
            <button
              key={b.user_id}
              type="button"
              onClick={() => openFor(b.user_id)}
              className="w-full text-left"
              aria-haspopup="dialog"
            >
              <MaterialCard className="p-5 md:p-8">
                <div className="flex items-center gap-3">
                  <div
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#2A2A2A] text-sm font-semibold text-[#E3E3E3]"
                    aria-hidden="true"
                  >
                    {letter}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold tracking-tight">{label}</p>
                  </div>
                </div>

                <div className="mt-4 h-px w-full bg-white/10" />

                <div className="mt-4 flex items-baseline justify-between gap-4">
                  <p
                    className={
                      "text-sm font-medium " +
                      (isPositive
                        ? "text-green-400"
                        : isNegative
                          ? "text-red-400"
                          : "text-[#C4C7C5]")
                    }
                  >
                    {isPositive ? "Gets back" : isNegative ? "Owes" : "Settled"}
                  </p>
                  <p
                    className={
                      "text-lg font-semibold tabular-nums " +
                      (isPositive
                        ? "text-green-400"
                        : isNegative
                          ? "text-red-400"
                          : "text-[#E3E3E3]")
                    }
                  >
                    {formatCurrency(netAbs)}
                  </p>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-3">
                  <div>
                    <dt className="text-xs text-[#C4C7C5]">Paid</dt>
                    <dd className="text-sm font-medium tabular-nums">{formatCurrency(b.paid)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[#C4C7C5]">Share</dt>
                    <dd className="text-sm font-medium tabular-nums">{formatCurrency(b.owed)}</dd>
                  </div>
                </dl>
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
          className="fixed inset-0 z-50"
        >
          <button
            type="button"
            onClick={close}
            className="absolute inset-0 bg-black/40"
            aria-label="Close"
          />

          <div className="fixed right-0 top-0 z-10 h-full w-full max-w-md transform overflow-hidden bg-[#1E1E1E] shadow-2xl transition-transform duration-300">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 p-4">
              <div className="min-w-0">
                <h2 id={dialogTitleId} className="truncate text-base font-semibold tracking-tight text-[#E3E3E3]">
                  {selected.username?.trim() ? `@${selected.username.trim()}` : selected.name?.trim() || selected.email}
                </h2>
                {!selected.username?.trim() ? (
                  <p className="truncate text-sm text-[#C4C7C5]">{selected.email}</p>
                ) : null}
              </div>

              <button
                type="button"
                onClick={close}
                className="rounded-full bg-white/5 px-4 py-2 text-sm font-medium text-[#E3E3E3] hover:bg-white/10"
              >
                Close
              </button>
            </div>

            <div className="scrollbar-hide -mx-4 mt-3 overflow-x-auto px-4">
              <div className="flex w-max items-center gap-2 whitespace-nowrap pb-2">
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
                    "inline-flex h-9 items-center justify-center rounded-full px-4 text-sm font-medium transition-colors " +
                    (tab === key
                      ? "bg-[#333537] text-[#E3E3E3]"
                      : "bg-transparent text-[#C4C7C5] hover:bg-white/5 hover:text-[#E3E3E3]")
                  }
                >
                  {label}
                </button>
              ))}
              </div>
            </div>

            <div className="h-[calc(100%-112px)] overflow-y-auto p-4">

            {tab === "overview" ? (
              <div className="space-y-4">
                <MaterialCard className="p-4">
                  <p className="text-sm font-semibold tracking-tight">Your balance</p>
                  <dl className="mt-3 grid grid-cols-3 gap-3">
                    <div>
                      <dt className="text-xs text-[#C4C7C5]">You paid</dt>
                      <dd className="text-sm font-semibold tabular-nums">{formatCurrency(selected.paid)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-[#C4C7C5]">Your share</dt>
                      <dd className="text-sm font-semibold tabular-nums">{formatCurrency(selected.owed)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-[#C4C7C5]">Net</dt>
                      <dd
                        className={
                          "text-sm font-semibold tabular-nums " +
                          (selected.net > 0
                            ? "text-green-400"
                            : selected.net < 0
                              ? "text-red-400"
                              : "text-[#C4C7C5]")
                        }
                      >
                        {formatCurrency(selected.net)}
                      </dd>
                    </div>
                  </dl>

                  <p className="mt-3 text-sm text-[#C4C7C5]">
                    {selected.net > 0
                      ? `You get back ${formatCurrency(Math.abs(selected.net))}`
                      : selected.net < 0
                        ? `You owe ${formatCurrency(Math.abs(selected.net))}`
                        : "Everyone is settled up"}
                  </p>
                </MaterialCard>

                <MaterialCard className="p-4">
                  <p className="text-sm font-semibold tracking-tight">Per expense breakdown</p>
                  {netPerExpense.length === 0 ? (
                    <p className="mt-2 text-sm text-[#C4C7C5]">No activity yet.</p>
                  ) : (
                    <ul className="mt-3 divide-y divide-white/10">
                      {netPerExpense.map((row) => {
                        const isPositive = row.net > 0;
                        const isNegative = row.net < 0;
                        return (
                          <li key={row.expense_id} className="py-2">
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">{row.description}</p>
                                <p className="text-xs text-[#C4C7C5]">{formatDate(row.date)}</p>
                              </div>
                              <div className="text-right">
                                <p
                                  className={
                                    "text-sm font-semibold tabular-nums " +
                                    (isPositive
                                      ? "text-green-400"
                                      : isNegative
                                        ? "text-red-400"
                                        : "text-[#C4C7C5]")
                                  }
                                >
                                  {formatCurrency(row.net)}
                                </p>
                                <p className="text-xs text-[#C4C7C5]">
                                  Paid {formatCurrency(row.paid)} · Owed {formatCurrency(row.owed)}
                                </p>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </MaterialCard>
              </div>
            ) : null}

            {tab === "paid" ? (
              <MaterialCard className="p-4">
                <p className="text-sm font-semibold tracking-tight">Paid expenses</p>
                {paidLog.length === 0 ? (
                  <p className="mt-2 text-sm text-[#C4C7C5]">No paid expenses yet.</p>
                ) : (
                  <ul className="mt-3 divide-y divide-white/10">
                    {paidLog.map((row) => (
                      <li key={row.expense_id} className="py-2">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{row.description}</p>
                            <p className="text-xs text-[#C4C7C5]">{formatDate(row.date)}</p>
                            {row.payersLabel ? (
                              <p className="mt-1 text-xs text-[#C4C7C5]">
                                Payers: {row.payersLabel}
                              </p>
                            ) : null}
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold tabular-nums">{formatCurrency(row.amount_paid)}</p>
                            <p className="text-xs text-[#C4C7C5]">
                              Total {formatCurrency(row.total_amount)}
                            </p>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </MaterialCard>
            ) : null}

            {tab === "owed" ? (
              <MaterialCard className="p-4">
                <p className="text-sm font-semibold tracking-tight">Owed expenses</p>
                {owedLog.length === 0 ? (
                  <p className="mt-2 text-sm text-[#C4C7C5]">No owed expenses yet.</p>
                ) : (
                  <ul className="mt-3 divide-y divide-white/10">
                    {owedLog.map((row) => (
                      <li key={row.expense_id} className="py-2">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{row.description}</p>
                            <p className="text-xs text-[#C4C7C5]">{formatDate(row.date)}</p>
                            <p className="mt-1 text-xs text-[#C4C7C5]">
                              Split type: {row.split_type}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold tabular-nums">{formatCurrency(row.amount_owed)}</p>
                            <p className="text-xs text-[#C4C7C5]">
                              Total {formatCurrency(row.total_amount)}
                            </p>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </MaterialCard>
            ) : null}

            {tab === "settlement" ? (
              <div className="space-y-4">
                <MaterialCard className="p-4">
                  <p className="text-sm font-semibold tracking-tight">
                    Who this member needs to pay
                  </p>
                  {settlementPreview.pays.length === 0 ? (
                    <p className="mt-2 text-sm text-[#C4C7C5]">No payments needed.</p>
                  ) : (
                    <ul className="mt-3 divide-y divide-white/10">
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
                </MaterialCard>

                <MaterialCard className="p-4">
                  <p className="text-sm font-semibold tracking-tight">
                    Who needs to pay this member
                  </p>
                  {settlementPreview.gets.length === 0 ? (
                    <p className="mt-2 text-sm text-[#C4C7C5]">No one owes them in the settlement plan.</p>
                  ) : (
                    <ul className="mt-3 divide-y divide-white/10">
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
                </MaterialCard>
              </div>
            ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
