import type { ReactNode } from "react";

export interface TripOverviewTrip {
  name: string;
  /** ISO date string or any human-readable string. */
  start_date: string;
  /** ISO date string or any human-readable string. */
  end_date: string;
}

export interface TripOverviewMember {
  user_id: string;
  name?: string | null;
}

export interface TripOverviewBalance {
  user_id: string;
  /** Net balance in trip currency. Positive means should receive; negative means owes. */
  amount: number;
}

export interface TripOverviewSettlement {
  /** Debtor (sender). */
  payer_id: string;
  /** Creditor (receiver). */
  payee_id: string;
  amount: number;
}

export interface TripOverviewLog {
  id: string;
  action_type: string;
  performed_by: string;
  /** ISO timestamp string. */
  timestamp: string;
  details: unknown;
}

export interface TripOverviewProps {
  trip: TripOverviewTrip;
  members: TripOverviewMember[];
  balances: TripOverviewBalance[];
  settlements: TripOverviewSettlement[];
  logs: TripOverviewLog[];

  /** Optional slot for future controls (e.g., actions/buttons). */
  children?: ReactNode;
}

export function TripOverview(props: TripOverviewProps) {
  const { trip, members, balances } = props;

  const dateRange = `${trip.start_date} → ${trip.end_date}`;

  const balanceByUserId = new Map(balances.map((b) => [b.user_id, b.amount]));

  const formatMoney = (amount: number) => `$${Math.abs(amount).toFixed(2)}`;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <div className="rounded-lg border border-black/10 p-4">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{trip.name}</h1>
          <p className="text-sm text-black/60">{dateRange}</p>
        </header>

        <section className="mt-6">
          <h2 className="text-base font-semibold tracking-tight">Balances</h2>
          <div className="mt-3 rounded-md border border-black/10">
            <ul className="divide-y divide-black/10">
              {members.map((member) => {
                const displayName = member.name?.trim() || "Unnamed member";
                const amount = balanceByUserId.get(member.user_id);

                const isZero = typeof amount === "number" && Math.abs(amount) < 1e-9;
                const isPositive = typeof amount === "number" && amount > 0;
                const isNegative = typeof amount === "number" && amount < 0;

                const balanceText =
                  typeof amount !== "number"
                    ? "—"
                    : isZero
                      ? "Settled"
                      : isPositive
                        ? `Get back ${formatMoney(amount)}`
                        : `Owe ${formatMoney(amount)}`;

                const balanceClassName =
                  typeof amount !== "number"
                    ? "text-black/60"
                    : isZero
                      ? "text-black/60"
                      : isPositive
                        ? "text-green-700"
                        : "text-red-700";

                return (
                  <li
                    key={member.user_id}
                    className="flex items-center justify-between gap-4 px-3 py-2"
                  >
                    <span className="text-sm">{displayName}</span>
                    <span
                      className={`min-w-36 text-right text-sm tabular-nums ${balanceClassName}`}
                    >
                      {balanceText}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}

export default TripOverview;
