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
  const { trip, members, balances, settlements, logs } = props;

  const dateRange = `${trip.start_date} → ${trip.end_date}`;

  const balanceByUserId = new Map(balances.map((b) => [b.user_id, b.amount]));
  const memberNameByUserId = new Map(
    members.map((m) => [m.user_id, m.name?.trim() || "Unnamed member"]),
  );

  const formatMoney = (amount: number) => `$${Math.abs(amount).toFixed(2)}`;

  const formatRelativeTime = (isoTimestamp: string) => {
    const eventTime = new Date(isoTimestamp).getTime();
    const nowTime = Date.now();
    if (!Number.isFinite(eventTime)) return "";

    const diffMs = Math.max(0, nowTime - eventTime);
    const minutes = Math.floor(diffMs / 60_000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? "" : "s"} ago`;
  };

  const sortedLogs = logs
    .slice()
    .sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );

  const describeLog = (log: TripOverviewLog) => {
    const actorName = memberNameByUserId.get(log.performed_by) || "Unknown member";

    if (
      log.action_type === "EXPENSE_CREATED" &&
      log.details &&
      typeof log.details === "object" &&
      "description" in log.details
    ) {
      const details = log.details as { description?: unknown };
      const description =
        typeof details.description === "string" && details.description.trim()
          ? details.description.trim()
          : "an expense";
      return `${actorName} added ${description} expense`;
    }

    return `${actorName} ${log.action_type.replaceAll("_", " ").toLowerCase()}`;
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <div className="space-y-6">
        <header className="rounded-lg border border-black/10 p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight">{trip.name}</h1>
              <p className="text-sm text-black/60">{dateRange}</p>
            </div>

            {props.children ? <div className="shrink-0">{props.children}</div> : null}
          </div>
        </header>

        <section className="rounded-lg border border-black/10 p-4">
          <div className="space-y-1">
            <h2 className="text-base font-semibold tracking-tight">Balances</h2>
            <p className="text-sm text-black/60">
              Net balance per member (after simplification).
            </p>
          </div>

          <ul className="mt-3 divide-y divide-black/10">
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
                  className="flex items-center justify-between gap-4 py-2"
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
        </section>

        <section className="rounded-lg border border-black/10 p-4">
          <div className="space-y-1">
            <h2 className="text-base font-semibold tracking-tight">Settlement Plan</h2>
            <p className="text-sm text-black/60">
              Suggested payments to settle the trip.
            </p>
          </div>

          {settlements.length === 0 ? (
            <p className="mt-3 text-sm text-black/60">No settlements needed.</p>
          ) : (
            <ul className="mt-3 divide-y divide-black/10">
              {settlements.map((s, index) => {
                const payerName =
                  memberNameByUserId.get(s.payer_id) || "Unknown member";
                const payeeName =
                  memberNameByUserId.get(s.payee_id) || "Unknown member";

                return (
                  <li
                    key={`${s.payer_id}-${s.payee_id}-${index}`}
                    className="flex items-center justify-between gap-4 py-2"
                  >
                    <span className="text-sm">
                      <span className="font-medium">{payerName}</span> pays{" "}
                      <span className="font-medium">{payeeName}</span>
                    </span>
                    <span className="min-w-24 text-right text-sm tabular-nums font-medium">
                      {formatMoney(s.amount)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-black/10 p-4">
          <div className="space-y-1">
            <h2 className="text-base font-semibold tracking-tight">Trip Activity</h2>
            <p className="text-sm text-black/60">A chronological record of actions.</p>
          </div>

          {sortedLogs.length === 0 ? (
            <p className="mt-3 text-sm text-black/60">No activity yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-black/10">
              {sortedLogs.map((log) => {
                const relative = formatRelativeTime(log.timestamp);
                return (
                  <li key={log.id} className="py-2">
                    <p className="text-sm text-black/70">
                      {describeLog(log)}
                      {relative ? (
                        <span className="text-black/50"> – {relative}</span>
                      ) : null}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

export default TripOverview;
