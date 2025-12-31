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
  const { trip } = props;

  const dateRange = `${trip.start_date} → ${trip.end_date}`;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <div className="rounded-lg border border-black/10 p-4">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{trip.name}</h1>
          <p className="text-sm text-black/60">{dateRange}</p>
        </header>

        {/* Other dashboard sections will be added later. */}
      </div>
    </div>
  );
}

export default TripOverview;
