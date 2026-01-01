'use client';

import { useMemo, useState } from 'react';
import { Menu, X } from 'lucide-react';

import MaterialCard from '@/components/ui/MaterialCard';
import MaterialButton from '@/components/ui/MaterialButton';
import MaterialInput from '@/components/ui/MaterialInput';

import { AddExpenseModal } from '@/components/expenses/AddExpenseModal';
import { formatTaka } from '@/lib/money';

type TripTab =
  | 'overview'
  | 'expenses'
  | 'settlement'
  | 'team'
  | 'activity'
  | 'settings';

const TABS: Array<{ key: TripTab; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'settlement', label: 'Settlement' },
  { key: 'team', label: 'Team' },
  { key: 'activity', label: 'Activity' },
  { key: 'settings', label: 'Settings' },
];

export type TripViewBalance = {
  user_id: string;
  paid: number;
  owed: number;
  net: number;
};

export type TripViewMember = {
  user_id: string;
  email: string | null;
  full_name: string | null;
};

export type TripViewExpense = {
  id: string;
  description: string;
  amount: number;
  currency?: string | null;
  created_at: Date | string;
  created_by?: string | null;
};

export type TripViewSettlement = {
  from_user_id: string;
  to_user_id: string;
  amount: number;
};

export type TripViewLog = {
  id: string;
  created_at: Date | string;
  type: string;
  message?: string | null;
  actor_user_id?: string | null;
};

export type TripViewTrip = {
  id: string;
  name: string;
  destination?: string | null;
  start_date?: Date | string | null;
  end_date?: Date | string | null;
  creator_id?: string | null;
};

export type TripViewCurrentUser = {
  id: string;
  email: string | null;
  full_name: string | null;
};

export type TripViewProps = {
  trip: TripViewTrip;
  expenses: TripViewExpense[];
  members: TripViewMember[];
  balances: TripViewBalance[];
  settlements: TripViewSettlement[];
  logs: TripViewLog[];
  currentUser: TripViewCurrentUser;

  onInviteMember?: (email: string) => Promise<{ success: boolean; message?: string }>;
  onUpdateTrip?: (next: {
    name: string;
    destination?: string | null;
    start_date?: string | null;
    end_date?: string | null;
  }) => Promise<{ success: boolean; message?: string }>;
  onLeaveTrip?: () => Promise<{ success: boolean; message?: string }>;
  onDeleteTrip?: () => Promise<{ success: boolean; message?: string }>;
};

function formatCurrency(amount: number) {
  return formatTaka(amount, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function toIsoDateInput(value: Date | string | null | undefined) {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function displayName(member: { full_name: string | null; email: string | null }) {
  return member.full_name?.trim() || member.email?.trim() || 'Unknown';
}

export function TripView({
  trip,
  expenses,
  members,
  balances,
  settlements,
  logs,
  currentUser,
  onInviteMember,
  onUpdateTrip,
  onLeaveTrip,
  onDeleteTrip,
}: TripViewProps) {
  const [activeTab, setActiveTab] = useState<TripTab>('overview');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const totalTripCost = useMemo(() => {
    return expenses.reduce((sum, exp) => sum + (Number.isFinite(exp.amount) ? exp.amount : 0), 0);
  }, [expenses]);

  const myBalance = useMemo(() => {
    return balances.find((b) => b.user_id === currentUser.id) ?? {
      user_id: currentUser.id,
      paid: 0,
      owed: 0,
      net: 0,
    };
  }, [balances, currentUser.id]);

  const memberById = useMemo(() => {
    const map = new Map<string, TripViewMember>();
    for (const m of members) map.set(m.user_id, m);
    return map;
  }, [members]);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteStatus, setInviteStatus] = useState<{ kind: 'idle' | 'ok' | 'err'; text?: string }>({
    kind: 'idle',
  });

  const [settingsName, setSettingsName] = useState(trip.name);
  const [settingsDestination, setSettingsDestination] = useState(trip.destination ?? '');
  const [settingsStart, setSettingsStart] = useState(toIsoDateInput(trip.start_date));
  const [settingsEnd, setSettingsEnd] = useState(toIsoDateInput(trip.end_date));
  const [settingsStatus, setSettingsStatus] = useState<{ kind: 'idle' | 'ok' | 'err'; text?: string }>({
    kind: 'idle',
  });

  const showFab = activeTab === 'expenses';

  function selectTab(next: TripTab) {
    setActiveTab(next);
    setIsMobileMenuOpen(false);
  }

  async function handleInvite() {
    const email = inviteEmail.trim();
    if (!email) {
      setInviteStatus({ kind: 'err', text: 'Enter an email.' });
      return;
    }
    if (!onInviteMember) {
      setInviteStatus({ kind: 'err', text: 'Invite is not wired yet.' });
      return;
    }

    setInviteStatus({ kind: 'idle' });
    try {
      const res = await onInviteMember(email);
      if (res.success) {
        setInviteEmail('');
        setInviteStatus({ kind: 'ok', text: res.message ?? 'Invite sent.' });
      } else {
        setInviteStatus({ kind: 'err', text: res.message ?? 'Invite failed.' });
      }
    } catch {
      setInviteStatus({ kind: 'err', text: 'Invite failed.' });
    }
  }

  async function handleSaveSettings() {
    if (!onUpdateTrip) {
      setSettingsStatus({ kind: 'err', text: 'Saving is not wired yet.' });
      return;
    }

    setSettingsStatus({ kind: 'idle' });
    try {
      const res = await onUpdateTrip({
        name: settingsName.trim(),
        destination: settingsDestination.trim() || null,
        start_date: settingsStart || null,
        end_date: settingsEnd || null,
      });
      setSettingsStatus({ kind: res.success ? 'ok' : 'err', text: res.message });
    } catch {
      setSettingsStatus({ kind: 'err', text: 'Save failed.' });
    }
  }

  async function handleLeaveTrip() {
    if (!onLeaveTrip) return;
    await onLeaveTrip();
  }

  async function handleDeleteTrip() {
    if (!onDeleteTrip) return;
    await onDeleteTrip();
  }

  const mobileHeaderTitle = trip.name?.trim() || 'Trip';

  return (
    <div className="space-y-4">
      {/* Mobile header (title + hamburger) */}
      <div className="flex items-center justify-between gap-3 md:hidden">
        <div className="min-w-0">
          <div className="truncate text-base font-semibold tracking-tight text-[#E3E3E3]">{mobileHeaderTitle}</div>
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-[#E3E3E3] transition-colors hover:bg-white/10"
          aria-label="Open menu"
          onClick={() => setIsMobileMenuOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Desktop tabs */}
      <div className="scrollbar-hide -mx-4 hidden overflow-x-auto px-4 md:flex">
        <div className="flex w-max items-center gap-2 whitespace-nowrap">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => selectTab(tab.key)}
                className={
                  isActive
                    ? 'rounded-full bg-[#A8C7FA] px-4 py-2 text-sm font-medium text-[#062E6F] transition-colors'
                    : 'px-2 py-2 text-sm font-medium text-[#C4C7C5] transition-colors hover:text-[#E3E3E3]'
                }
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile drawer (full-screen overlay) */}
      {isMobileMenuOpen ? (
        <div className="fixed inset-0 z-50 bg-[#121212] md:hidden">
          <div className="flex items-center justify-between border-b border-white/5 p-4">
            <div className="min-w-0">
              <div className="truncate text-base font-semibold text-[#E3E3E3]">{mobileHeaderTitle}</div>
              <div className="text-xs text-[#C4C7C5]">Navigate</div>
            </div>
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-[#E3E3E3] transition-colors hover:bg-white/10"
              aria-label="Close menu"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="flex flex-col">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => selectTab(tab.key)}
                  className={
                    'p-4 text-left text-base ' +
                    'border-b border-white/5 ' +
                    (isActive ? 'bg-white/5 text-[#A8C7FA]' : 'text-[#E3E3E3]')
                  }
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      ) : null}

      {/* Bento grid layout */}
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-3 lg:gap-6">
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
          {activeTab === 'overview' ? (
            <>
              <MaterialCard>
                <div className="flex flex-col gap-2">
                  <div className="text-sm text-[#C4C7C5]">Total trip cost</div>
                  <div className="text-4xl font-semibold tracking-tight text-[#E3E3E3]">
                    {formatCurrency(totalTripCost)}
                  </div>
                  <div className="text-sm text-[#C4C7C5]">
                    {trip.destination ? `${trip.destination} · ` : ''}
                    {formatDate(trip.start_date)}
                    {trip.start_date || trip.end_date ? ' – ' : ''}
                    {formatDate(trip.end_date)}
                  </div>
                </div>
              </MaterialCard>

              <MaterialCard>
                <div className="space-y-2">
                  <div className="text-base font-semibold text-[#E3E3E3]">Balance</div>
                  <div className="grid grid-cols-1 gap-3">
                    <div className="rounded-[18px] bg-[#2A2A2A] p-4">
                      <div className="text-xs text-[#C4C7C5]">My balance</div>
                      <div
                        className={
                          myBalance.net >= 0
                            ? 'mt-1 text-2xl font-semibold text-emerald-300'
                            : 'mt-1 text-2xl font-semibold text-rose-300'
                        }
                      >
                        {formatCurrency(Math.abs(myBalance.net))}
                      </div>
                      <div className="mt-1 text-xs text-[#C4C7C5]">
                        {myBalance.net >= 0 ? 'You are owed' : 'You owe'}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="rounded-[18px] bg-[#2A2A2A] p-4">
                        <div className="text-xs text-[#C4C7C5]">My total contribution</div>
                        <div className="mt-1 text-lg font-semibold text-[#E3E3E3]">
                          {formatCurrency(myBalance.paid)}
                        </div>
                      </div>
                      <div className="rounded-[18px] bg-[#2A2A2A] p-4">
                        <div className="text-xs text-[#C4C7C5]">My total share</div>
                        <div className="mt-1 text-lg font-semibold text-[#E3E3E3]">
                          {formatCurrency(myBalance.owed)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </MaterialCard>
            </>
          ) : null}

          {activeTab === 'expenses' ? (
            <MaterialCard>
              <div className="space-y-3">
                <div>
                  <div className="text-xl font-semibold text-[#E3E3E3]">Expenses</div>
                  <div className="text-sm text-[#C4C7C5]">All recorded items</div>
                </div>
                <ExpenseList expenses={expenses} />
              </div>
            </MaterialCard>
          ) : null}

          {activeTab === 'settlement' ? (
            <MaterialCard>
              <div className="space-y-3">
                <div>
                  <div className="text-xl font-semibold text-[#E3E3E3]">Settlement</div>
                  <div className="text-sm text-[#C4C7C5]">Debt plan</div>
                </div>

                {settlements.length === 0 ? (
                  <div className="text-sm text-[#C4C7C5]">No settlement transactions needed.</div>
                ) : (
                  <div className="space-y-2">
                    {settlements.map((t, idx) => {
                      const from = memberById.get(t.from_user_id);
                      const to = memberById.get(t.to_user_id);
                      const fromLabel = from ? displayName(from) : 'Unknown';
                      const toLabel = to ? displayName(to) : 'Unknown';

                      return (
                        <MaterialCard key={`${t.from_user_id}-${t.to_user_id}-${idx}`} className="p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-[#E3E3E3]">
                                {fromLabel} <span className="text-[#C4C7C5]">➔</span> {toLabel}
                              </div>
                              <div className="truncate text-xs text-[#C4C7C5]">
                                {from?.email ?? ''}{from?.email && to?.email ? ' · ' : ''}
                                {to?.email ?? ''}
                              </div>
                            </div>
                            <div className="text-right text-sm font-semibold text-[#E3E3E3]">
                              {formatCurrency(t.amount)}
                            </div>
                          </div>
                        </MaterialCard>
                      );
                    })}
                  </div>
                )}
              </div>
            </MaterialCard>
          ) : null}

          {activeTab === 'team' ? (
            <div className="space-y-4">
              <MaterialCard>
                <div className="space-y-3">
                  <div>
                    <div className="text-xl font-semibold text-[#E3E3E3]">Team</div>
                    <div className="text-sm text-[#C4C7C5]">Members in this trip</div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <LabeledField label="Invite member">
                      <MaterialInput
                        placeholder="name@example.com"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                      />
                    </LabeledField>
                    <MaterialButton variant="tonal" onClick={handleInvite} className="h-11">
                      Invite
                    </MaterialButton>
                  </div>

                  {inviteStatus.kind !== 'idle' ? (
                    <div
                      className={
                        inviteStatus.kind === 'ok'
                          ? 'text-sm text-emerald-300'
                          : 'text-sm text-rose-300'
                      }
                    >
                      {inviteStatus.text}
                    </div>
                  ) : null}
                </div>
              </MaterialCard>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {members.map((m) => {
                  const role = trip.creator_id && m.user_id === trip.creator_id ? 'Creator' : 'Member';
                  return (
                    <MaterialCard key={m.user_id} className="p-4">
                      <div className="space-y-1">
                        <div className="truncate text-sm font-semibold text-[#E3E3E3]">{displayName(m)}</div>
                        <div className="truncate text-xs text-[#C4C7C5]">{m.email ?? ''}</div>
                        <div className="mt-2 inline-flex rounded-full bg-white/5 px-2 py-1 text-xs text-[#C4C7C5]">
                          {role}
                        </div>
                      </div>
                    </MaterialCard>
                  );
                })}
              </div>
            </div>
          ) : null}

          {activeTab === 'activity' ? (
            <MaterialCard>
              <div className="space-y-3">
                <div>
                  <div className="text-xl font-semibold text-[#E3E3E3]">Activity</div>
                  <div className="text-sm text-[#C4C7C5]">Trip logs</div>
                </div>

                {logs.length === 0 ? (
                  <div className="text-sm text-[#C4C7C5]">No activity yet.</div>
                ) : (
                  <ol className="relative pl-6">
                    <div className="absolute bottom-0 left-[11px] top-0 w-px bg-white/10" />
                    {logs
                      .slice()
                      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                      .map((log) => {
                        const when = formatDate(log.created_at);
                        return (
                          <li key={log.id} className="relative pb-4">
                            <div className="absolute left-[6px] top-[6px] h-3 w-3 rounded-full bg-[#A8C7FA]" />
                            <div className="space-y-1">
                              <div className="text-sm font-medium text-[#E3E3E3]">
                                {log.message?.trim() || log.type}
                              </div>
                              <div className="text-xs text-[#C4C7C5]">{when}</div>
                            </div>
                          </li>
                        );
                      })}
                  </ol>
                )}
              </div>
            </MaterialCard>
          ) : null}

          {activeTab === 'settings' ? (
            <div className="space-y-4">
              <MaterialCard>
                <div className="space-y-3">
                  <div>
                    <div className="text-xl font-semibold text-[#E3E3E3]">Edit details</div>
                    <div className="text-sm text-[#C4C7C5]">Rename or change dates</div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <LabeledField label="Trip name">
                      <MaterialInput value={settingsName} onChange={(e) => setSettingsName(e.target.value)} />
                    </LabeledField>
                    <LabeledField label="Destination">
                      <MaterialInput value={settingsDestination} onChange={(e) => setSettingsDestination(e.target.value)} />
                    </LabeledField>
                    <LabeledField label="Start date">
                      <MaterialInput type="date" value={settingsStart} onChange={(e) => setSettingsStart(e.target.value)} />
                    </LabeledField>
                    <LabeledField label="End date">
                      <MaterialInput type="date" value={settingsEnd} onChange={(e) => setSettingsEnd(e.target.value)} />
                    </LabeledField>
                  </div>

                  {settingsStatus.kind !== 'idle' ? (
                    <div
                      className={
                        settingsStatus.kind === 'ok'
                          ? 'text-sm text-emerald-300'
                          : 'text-sm text-rose-300'
                      }
                    >
                      {settingsStatus.text}
                    </div>
                  ) : null}

                  <div className="flex items-center justify-end">
                    <MaterialButton variant="filled" onClick={handleSaveSettings}>
                      Save changes
                    </MaterialButton>
                  </div>
                </div>
              </MaterialCard>

              <MaterialCard>
                <div className="space-y-3">
                  <div>
                    <div className="text-xl font-semibold text-[#E3E3E3]">Danger zone</div>
                    <div className="text-sm text-[#C4C7C5]">Edit/Delete options</div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <MaterialButton
                      variant="text"
                      onClick={handleLeaveTrip}
                      className="text-rose-300 hover:text-rose-200"
                      disabled={!onLeaveTrip}
                    >
                      Leave trip
                    </MaterialButton>
                    <MaterialButton
                      variant="filled"
                      onClick={handleDeleteTrip}
                      className="bg-rose-500 text-white hover:bg-rose-400"
                      disabled={!onDeleteTrip}
                    >
                      Delete trip
                    </MaterialButton>
                  </div>
                </div>
              </MaterialCard>
            </div>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col gap-4 lg:col-span-1">
          {activeTab === 'overview' ? (
            <MaterialCard>
              <div className="space-y-2">
                <div className="text-sm text-[#C4C7C5]">Me</div>
                <div className="truncate text-base font-semibold text-[#E3E3E3]">{displayName(currentUser)}</div>
                <div className="truncate text-sm text-[#C4C7C5]">{currentUser.email ?? ''}</div>
              </div>
            </MaterialCard>
          ) : null}

          {activeTab === 'expenses' ? (
            <MaterialCard>
              <div className="space-y-2">
                <div className="text-base font-semibold text-[#E3E3E3]">Quick actions</div>
                <div className="text-sm text-[#C4C7C5]">Add a new expense for this trip.</div>
              </div>
            </MaterialCard>
          ) : null}
        </div>
      </div>

      {/* Add Expense FAB (Expenses only) */}
      {showFab && !isMobileMenuOpen ? (
        <div className="fixed bottom-6 right-6 z-40">
          <AddExpenseModal
            tripId={trip.id}
            currentUserId={currentUser.id}
            members={members.map((m) => ({
              id: m.user_id,
              name: m.full_name,
              email: m.email ?? '',
            }))}
            triggerFab
            triggerLabel="+ Add Expense"
            triggerVariant="filled"
          />
        </div>
      ) : null}
    </div>
  );
}

function ExpenseList({ expenses }: { expenses: TripViewExpense[] }) {
  if (expenses.length === 0) {
    return <div className="text-sm text-[#C4C7C5]">No expenses yet.</div>;
  }

  const sorted = expenses
    .slice()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <div className="space-y-2">
      {sorted.map((exp) => {
        return (
          <MaterialCard key={exp.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-[#E3E3E3]">{exp.description}</div>
                <div className="text-xs text-[#C4C7C5]">{formatDate(exp.created_at)}</div>
              </div>
              <div className="text-right text-sm font-semibold text-[#E3E3E3]">
                {formatCurrency(exp.amount)}
              </div>
            </div>
          </MaterialCard>
        );
      })}
    </div>
  );
}

function LabeledField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-xs text-[#C4C7C5]">{label}</div>
      {children}
    </div>
  );
}
