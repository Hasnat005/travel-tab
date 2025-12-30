export type UserId = string;

export interface TripMembersInput {
  /** List of user IDs who are members of a trip. */
  member_ids: UserId[];
}

export interface ExpensePayerInput {
  user_id: UserId;
  /** Amount this user paid toward the expense, in the trip currency. */
  amount_paid: number;
}

export interface ExpenseShareInput {
  user_id: UserId;
  /** Amount this user owes for the expense, in the trip currency. */
  amount_owed: number;
}

export interface ExpenseInput {
  /** Unique identifier of the expense (string UUID from DB). */
  id: string;
  payers: ExpensePayerInput[];
  shares: ExpenseShareInput[];
}

export interface DebtCalculationInput {
  members: TripMembersInput;
  expenses: ExpenseInput[];
}

export interface SettlementTransaction {
  /** The user who should receive money. */
  payer_id: UserId;
  /** The user who should send money. */
  payee_id: UserId;
  /** Amount to be transferred, in the trip currency. */
  amount: number;
}

export interface DebtCalculationOutput {
  settlements: SettlementTransaction[];
}
