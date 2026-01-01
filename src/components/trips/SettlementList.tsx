"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, Handshake, X } from "lucide-react";

import MaterialButton from "@/components/ui/MaterialButton";
import MaterialCard from "@/components/ui/MaterialCard";
import MaterialInput from "@/components/ui/MaterialInput";
import { formatTaka } from "@/lib/money";
import { recordSettlement } from "@/app/_actions/expenses";

export type SettlementTx = {
  payer_id: string;
  payee_id: string;
  amount: number;
};

type Props = {
  tripId: string;
  settlements: SettlementTx[];
  memberLabelById: Record<string, string>;
};

function formatCurrency(amount: number) {
  return formatTaka(amount, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function SettlementList({ tripId, settlements, memberLabelById }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<SettlementTx | null>(null);
  const [amountText, setAmountText] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [settledKeys, setSettledKeys] = useState<Record<string, true>>({});

  const displayLabel = (raw: string) => (raw.startsWith("@") ? raw.slice(1) : raw);

  const settlementKey = (s: SettlementTx) => `${s.payer_id}:${s.payee_id}`;

  const selectedLabels = useMemo(() => {
    if (!selected) return null;
    return {
      payer: displayLabel(memberLabelById[selected.payer_id] ?? "Unknown member"),
      payee: displayLabel(memberLabelById[selected.payee_id] ?? "Unknown member"),
    };
  }, [memberLabelById, selected]);

  const close = () => {
    setOpen(false);
    setSelected(null);
    setAmountText("");
    setError(null);
  };

  const parseMoneyText = (value: string): { ok: true; amount: number } | { ok: false; message: string } => {
    const trimmed = value.trim();
    if (!trimmed) return { ok: false, message: "Enter an amount." };

    const numeric = Number(trimmed);
    if (!Number.isFinite(numeric)) return { ok: false, message: "Amount must be a number." };
    if (numeric <= 0) return { ok: false, message: "Amount must be greater than 0." };

    // Enforce at most 2 decimals (matches server-side rules).
    const cents = Math.round((numeric + Number.EPSILON) * 100);
    const normalized = cents / 100;
    if (Math.abs(normalized - numeric) > 1e-9) {
      return { ok: false, message: "Amount must have at most 2 decimal places." };
    }

    return { ok: true, amount: normalized };
  };

  const confirm = () => {
    if (!selected) return;

    const parsed = parseMoneyText(amountText);
    if (!parsed.ok) {
      setError(parsed.message);
      return;
    }

    setError(null);
    startTransition(async () => {
      const res = await recordSettlement(
        tripId,
        selected.payer_id,
        selected.payee_id,
        parsed.amount
      );
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setSettledKeys((prev) => ({ ...prev, [settlementKey(selected)]: true }));
      close();
    });
  };

  return (
    <>
      <ul className="mt-4 space-y-3">
        {settlements.map((s, idx) => {
          const payer = displayLabel(memberLabelById[s.payer_id] ?? "Unknown member");
          const payee = displayLabel(memberLabelById[s.payee_id] ?? "Unknown member");
          const key = settlementKey(s);
          const isSettled = Boolean(settledKeys[key]);
          const amountLabel = formatCurrency(s.amount);

          return (
            <li
              key={`${s.payer_id}-${s.payee_id}-${idx}`}
              className="rounded-[18px] bg-[#2A2A2A] p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#E3E3E3]">
                    <span className="font-semibold">{payer}</span> pays <span className="font-semibold">{payee}</span>
                  </p>

                  <p className="mt-2 whitespace-nowrap text-2xl font-semibold tabular-nums text-[#E3E3E3]">
                    {amountLabel}
                  </p>
                </div>

                <MaterialButton
                  variant="filled"
                  className="h-11 w-full shrink-0 whitespace-nowrap px-4 py-0 sm:w-auto"
                  disabled={isSettled || isPending}
                  aria-label={
                    isSettled
                      ? `Settled: ${payer} paid ${payee} ${formatCurrency(s.amount)}`
                      : `Settle ${formatCurrency(s.amount)} from ${payer} to ${payee}`
                  }
                  onClick={() => {
                    setSelected(s);
                    setOpen(true);
                    setAmountText(s.amount.toFixed(2));
                    setError(null);
                  }}
                >
                  {isSettled ? (
                    <Check className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Handshake className="h-4 w-4" aria-hidden="true" />
                  )}
                  {isSettled ? "Settled" : `Settle ${amountLabel}`}
                </MaterialButton>
              </div>
            </li>
          );
        })}
      </ul>

      {open && selected && selectedLabels ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => (isPending ? null : close())}
          />

          <MaterialCard className="relative w-full max-w-md p-5" role="dialog" aria-modal="true">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold tracking-tight">Confirm settlement</h3>
                <p className="mt-1 text-sm text-[#C4C7C5]">
                  Confirm that {selectedLabels.payer} paid {selectedLabels.payee}.
                </p>
              </div>

              <button
                type="button"
                onClick={() => (isPending ? null : close())}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#C4C7C5] hover:bg-white/5"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}

            <div className="mt-4 space-y-2">
              <label className="block text-xs font-medium text-[#C4C7C5]">Amount (Tk)</label>
              <MaterialInput
                inputMode="decimal"
                placeholder={selected.amount.toFixed(2)}
                value={amountText}
                onChange={(e) => {
                  setAmountText(e.target.value);
                  if (error) setError(null);
                }}
                disabled={isPending}
                aria-label="Settlement amount"
              />
              <p className="text-xs text-[#C4C7C5]">Suggested: {formatCurrency(selected.amount)}</p>
            </div>

            <div className="mt-5">
              <MaterialButton
                className="h-11 w-full whitespace-nowrap px-6 py-0"
                onClick={confirm}
                disabled={isPending}
              >
                {isPending ? "Saving…" : "Confirm payment"}
              </MaterialButton>
            </div>
          </MaterialCard>
        </div>
      ) : null}
    </>
  );
}
