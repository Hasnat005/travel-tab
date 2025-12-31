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

export function TripOverview(_props: TripOverviewProps) {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <div className="rounded-lg border border-black/10 p-4">
        {/* Structure-only component: UI sections will be added later. */}
      </div>
    </div>
  );
}

export default TripOverview;
