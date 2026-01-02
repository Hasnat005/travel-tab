import { notFound, redirect } from "next/navigation";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import AddExpenseModal from "@/components/expenses/AddExpenseModal";
import MemberList from "@/components/trips/MemberList";
import { calculateTripDebts } from "@/lib/debt-calculator";
import MemberCardsWithDetail from "@/components/trips/MemberCardsWithDetail";
import MaterialCard from "@/components/ui/MaterialCard";
import InviteLinkButton from "@/components/trips/InviteLinkButton";
import SettlementList from "@/components/trips/SettlementList";
import { TripTabTransitionProvider } from "@/components/trips/TripTabTransitionContext";
import TripTabNavClient from "@/components/trips/TripTabNavClient";
import TripTabContentPending from "@/components/trips/TripTabContentPending";
import TripGoToTabButton from "@/components/trips/TripGoToTabButton";
import { formatTaka } from "@/lib/money";
import { Plus } from "lucide-react";

function formatDate(d: Date) {
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatCurrency(amount: number) {
  return formatTaka(amount, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function toCents(amount: number) {
  return Math.round((amount + Number.EPSILON) * 100);
}

function fromCents(cents: number) {
  return Number((cents / 100).toFixed(2));
}

function detailsMessage(details: unknown): string | null {
  if (!details || typeof details !== "object") return null;
  const record = details as Record<string, unknown>;
  const message = record["message"];
  if (typeof message === "string") {
    const msg = message.trim();
    return msg ? msg : null;
  }
  return null;
}

export default async function TripDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tripId: string }>;
  searchParams?: Promise<{ tab?: string }>;
}) {
  const { tripId } = await params;
  const rawTab = (await searchParams)?.tab ?? "overview";
  const allowedTabs = new Set([
    "overview",
    "expenses",
    "settlement",
    "team",
    "activity",
    "settings",
  ]);
  const tab = allowedTabs.has(rawTab) ? rawTab : "overview";

  if (!tripId) {
    notFound();
  }

  const supabase = await createSupabaseServerClient();
  // Perf: fetch auth + base trip in parallel; only fetch heavy tab data as needed.
  const [
    {
      data: { user },
    },
    trip,
  ] = await Promise.all([
    supabase.auth.getUser(),
    prisma.trip.findUnique({
      where: { id: tripId },
      select: {
        id: true,
        name: true,
        destination: true,
        start_date: true,
        end_date: true,
        notes: true,
        creator_id: true,
        members: {
          select: {
            user_id: true,
            user: { select: { id: true, name: true, email: true, username: true } },
          },
        },
        _count: { select: { expenses: true, logs: true } },
      },
    }),
  ]);

  if (!user) redirect("/login");

  if (!trip) {
    notFound();
  }

  const isMember = trip.members.some((m) => m.user_id === user.id);
  if (!isMember) {
    notFound();
  }

  const expensesCount = await prisma.expense.count({
    where: { trip_id: tripId, is_settlement: false },
  });
  const logsCount = trip._count.logs;

  const needsFullExpenses = tab === "overview" || tab === "settlement";
  const needsExpenseList = tab === "expenses";
  const needsLogs = tab === "activity";

  type FullExpenseRow = {
    id: string;
    description: string;
    date: Date;
    total_amount: Prisma.Decimal;
    is_settlement: boolean;
    payers: Array<{
      user_id: string;
      amount_paid: Prisma.Decimal;
      user: { id: string; name: string | null; email: string; username: string | null };
    }>;
    shares: Array<{ user_id: string; amount_owed: Prisma.Decimal }>;
  };

  type ListExpenseRow = {
    id: string;
    description: string;
    date: Date;
    total_amount: Prisma.Decimal;
    payers: Array<{
      user_id: string;
      amount_paid: Prisma.Decimal;
      user: { name: string | null; email: string; username: string | null };
    }>;
  };

  const [totalAgg, paidAgg, owedAgg, fullExpenses, listExpenses, logs] = await Promise.all([
    prisma.expense.aggregate({
      where: { trip_id: tripId, is_settlement: false },
      _sum: { total_amount: true },
    }),
    prisma.expensePayer.groupBy({
      by: ["user_id"],
      where: { expense: { trip_id: tripId } },
      _sum: { amount_paid: true },
    }),
    prisma.expenseShare.groupBy({
      by: ["user_id"],
      where: { expense: { trip_id: tripId } },
      _sum: { amount_owed: true },
    }),
    needsFullExpenses
      ? prisma.expense.findMany({
          where: { trip_id: tripId },
          orderBy: [{ date: "desc" }, { created_at: "desc" }],
          select: {
            id: true,
            description: true,
            date: true,
            total_amount: true,
            is_settlement: true,
            payers: {
              select: {
                user_id: true,
                amount_paid: true,
                user: { select: { id: true, name: true, email: true, username: true } },
              },
            },
            shares: { select: { user_id: true, amount_owed: true } },
          },
        })
      : Promise.resolve([] as FullExpenseRow[]),
    needsExpenseList
      ? prisma.expense.findMany({
          where: { trip_id: tripId, is_settlement: false },
          orderBy: [{ date: "desc" }, { created_at: "desc" }],
          select: {
            id: true,
            description: true,
            date: true,
            total_amount: true,
            payers: {
              select: {
                user_id: true,
                amount_paid: true,
                user: { select: { name: true, email: true, username: true } },
              },
            },
          },
        })
      : Promise.resolve([] as ListExpenseRow[]),
    needsLogs
      ? prisma.tripLog.findMany({
          where: { trip_id: tripId },
          orderBy: { timestamp: "desc" },
          select: {
            id: true,
            action_type: true,
            details: true,
            timestamp: true,
            performer: { select: { id: true, name: true, email: true, username: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  const totalTripCost = totalAgg._sum?.total_amount?.toNumber() ?? 0;

  // R6: Member Cards & Balances
  // paid = sum(payers.amount_paid), owed = sum(shares.amount_owed), net = paid - owed
  const paidCentsByUser = new Map<string, number>();
  const owedCentsByUser = new Map<string, number>();
  for (const m of trip.members) {
    paidCentsByUser.set(m.user_id, 0);
    owedCentsByUser.set(m.user_id, 0);
  }

  for (const row of paidAgg) {
    const amount = row._sum.amount_paid?.toNumber() ?? 0;
    paidCentsByUser.set(row.user_id, toCents(amount));
  }

  for (const row of owedAgg) {
    const amount = row._sum.amount_owed?.toNumber() ?? 0;
    owedCentsByUser.set(row.user_id, toCents(amount));
  }

  const memberBalances = trip.members.map((m) => {
    const paid = fromCents(paidCentsByUser.get(m.user_id) ?? 0);
    const owed = fromCents(owedCentsByUser.get(m.user_id) ?? 0);
    const net = Number((paid - owed).toFixed(2));
    return {
      user_id: m.user_id,
      username: m.user.username,
      name: m.user.name?.trim() ? m.user.name : null,
      email: m.user.email,
      paid,
      owed,
      net,
    };
  });

  const yourBalance = memberBalances.find((m) => m.user_id === user.id) ?? null;

  const nonSettlementFullExpenses = fullExpenses.filter((e) => !e.is_settlement);

  // Perf: only serialize per-expense details (large) when needed.
  const clientExpenses = tab === "overview"
    ? nonSettlementFullExpenses.map((e) => ({
        id: e.id,
        description: e.description,
        date: e.date.toISOString(),
        total_amount: e.total_amount.toNumber(),
        payers: e.payers.map((p) => ({
          user_id: p.user_id,
          amount_paid: p.amount_paid.toNumber(),
          user: { name: p.user.name, email: p.user.email, username: p.user.username },
        })),
        shares: e.shares.map((s) => ({
          user_id: s.user_id,
          amount_owed: s.amount_owed.toNumber(),
        })),
      }))
    : [];

  // R9.4: Debt simplification / settlement plan (only when full expense detail is loaded)
  const settlements = needsFullExpenses
    ? calculateTripDebts(
        fullExpenses.map((e) => ({
          id: e.id,
          payers: e.payers.map((p) => ({
            user_id: p.user_id,
            amount_paid: p.amount_paid.toNumber(),
          })),
          shares: e.shares.map((s) => ({
            user_id: s.user_id,
            amount_owed: s.amount_owed.toNumber(),
          })),
        })),
        trip.members.map((m) => m.user_id)
      ).settlements
    : [];

  const memberLabelEntries = trip.members.map((m) => [
    m.user_id,
    m.user.username?.trim() ? `@${m.user.username.trim()}` : m.user.name?.trim() || m.user.email,
  ] as const);

  const memberLabelByIdRecord = Object.fromEntries(memberLabelEntries);

  function userLabel(u: { username?: string | null; name?: string | null; email?: string | null | undefined }) {
    const username = u.username?.trim();
    if (username) return `@${username}`;
    const name = u.name?.trim();
    if (name) return name;
    return u.email ?? "Unknown";
  }

  const tabItems: { key: string; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "expenses", label: "Expenses" },
    { key: "settlement", label: "Settlement" },
    { key: "team", label: "Team" },
    { key: "activity", label: "Activity" },
    { key: "settings", label: "Settings" },
  ];

  const showFab = tab === "overview" || tab === "expenses";

  const membersForModal = trip.members.map((m) => ({
    id: m.user_id,
    name: m.user.username?.trim() ? `@${m.user.username}` : m.user.name,
    email: m.user.email,
  }));

  return (
    <TripTabTransitionProvider tripId={tripId} currentTab={tab} tabItems={tabItems}>
      <div className="-mx-4 -my-4 flex flex-col gap-6 p-4 md:-mx-6 md:-my-6 md:grid md:grid-cols-12 md:gap-8 md:p-8 lg:-mx-8 lg:-my-8">
        <div className="md:col-span-12">
          <MaterialCard>
          <div className="space-y-4">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{trip.name}</h1>
              <p className="text-sm text-[#C4C7C5]">
                {trip.destination} · {formatDate(trip.start_date)} → {formatDate(trip.end_date)}
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-[18px] bg-[#2A2A2A] p-5 md:p-8">
                <p className="text-xs font-medium text-[#C4C7C5]">Total spent</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums md:text-3xl">
                  {formatCurrency(totalTripCost)}
                </p>
              </div>

              <div className="rounded-[18px] bg-[#2A2A2A] p-5 md:p-8">
                <p className="text-xs font-medium text-[#C4C7C5]">Your balance</p>
                <p
                  className={
                    "mt-2 text-2xl font-semibold tabular-nums md:text-3xl " +
                    (yourBalance
                      ? yourBalance.net > 0
                        ? "text-green-400"
                        : yourBalance.net < 0
                          ? "text-red-400"
                          : "text-[#E3E3E3]"
                      : "text-[#E3E3E3]")
                  }
                >
                  {formatCurrency(Math.abs(yourBalance?.net ?? 0))}
                </p>
                <p className="mt-1 text-sm text-[#C4C7C5]">
                  {yourBalance
                    ? yourBalance.net > 0
                      ? `You get back ${formatCurrency(Math.abs(yourBalance.net))}`
                      : yourBalance.net < 0
                        ? `You owe ${formatCurrency(Math.abs(yourBalance.net))}`
                        : "Everyone is settled up"
                    : ""}
                </p>
              </div>
            </div>
          </div>

          <TripTabNavClient />
          </MaterialCard>
        </div>

        <div className="flex flex-col gap-6 md:col-span-8">
          <TripTabContentPending>
            {tab === "overview" ? (
            <>
              <MaterialCard>
                <div className="space-y-1">
                  <h2 className="text-base font-semibold tracking-tight">Balances</h2>
                  <p className="text-sm text-[#C4C7C5]">
                    Paid, owed, and net balance per member.
                  </p>
                </div>

                <MemberCardsWithDetail
                  members={memberBalances}
                  expenses={clientExpenses}
                  settlements={settlements}
                />
              </MaterialCard>

              <MaterialCard>
                <div className="flex items-baseline justify-between gap-4">
                  <div className="space-y-1">
                    <h2 className="text-base font-semibold tracking-tight">Recent expenses</h2>
                    <p className="text-sm text-[#C4C7C5]">Last 3 expenses added.</p>
                  </div>
                  <TripGoToTabButton
                    tabKey="expenses"
                    className="text-sm font-medium text-[#A8C7FA] hover:underline"
                  >
                    View all
                  </TripGoToTabButton>
                </div>

                {expensesCount === 0 ? (
                  <p className="mt-3 text-sm text-[#C4C7C5]">Add your first expense to start splitting.</p>
                ) : (
                  <ul className="mt-4 divide-y divide-white/10">
                    {nonSettlementFullExpenses.slice(0, 3).map((e) => (
                      <li key={e.id} className="py-3">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-[#E3E3E3]">{e.description}</p>
                            <p className="text-xs text-[#C4C7C5]">{formatDate(e.date)}</p>
                          </div>
                          <p className="text-sm font-semibold tabular-nums text-[#E3E3E3]">
                            {formatCurrency(e.total_amount.toNumber())}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </MaterialCard>
            </>
          ) : null}

          {tab === "expenses" ? (
            <MaterialCard>
              <div className="space-y-1">
                <h2 className="text-base font-semibold tracking-tight">Expenses</h2>
                <p className="text-sm text-[#C4C7C5]">A list of costs logged for this trip.</p>
              </div>

              {expensesCount === 0 ? (
                <p className="mt-3 text-sm text-[#C4C7C5]">No expenses yet.</p>
              ) : (
                <div className="mt-4 grid gap-4">
                  {listExpenses.map((e) => {
                    const payerNames = e.payers
                      .map((p) => userLabel(p.user))
                      .filter(Boolean)
                      .join(", ");

                    return (
                      <div key={e.id} className="rounded-[18px] bg-[#2A2A2A] p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1">
                            <p className="text-base font-semibold tracking-tight">{e.description}</p>
                            <p className="text-sm text-[#C4C7C5]">
                              Paid by {payerNames || "Unknown"}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-base font-semibold tabular-nums">
                              {formatCurrency(e.total_amount.toNumber())}
                            </p>
                            <p className="text-sm text-[#C4C7C5]">{formatDate(e.date)}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </MaterialCard>
          ) : null}

          {tab === "settlement" ? (
            <MaterialCard>
              <div className="space-y-1">
                <h2 className="text-base font-semibold tracking-tight">Settlement Plan</h2>
                <p className="text-sm text-[#C4C7C5]">Suggested payments to settle the trip.</p>
              </div>

              {settlements.length === 0 ? (
                <p className="mt-3 text-sm text-[#C4C7C5]">No settlements needed.</p>
              ) : (
                <SettlementList
                  tripId={tripId}
                  settlements={settlements.map((s) => ({
                    payer_id: s.payer_id,
                    payee_id: s.payee_id,
                    amount: s.amount,
                  }))}
                  memberLabelById={memberLabelByIdRecord}
                />
              )}
            </MaterialCard>
          ) : null}

          {tab === "activity" ? (
            <MaterialCard>
              <div className="space-y-1">
                <h2 className="text-base font-semibold tracking-tight">Trip Activity</h2>
                <p className="text-sm text-[#C4C7C5]">A chronological record of actions.</p>
              </div>

              {logs.length === 0 ? (
                <p className="mt-3 text-sm text-[#C4C7C5]">No logs available.</p>
              ) : (
                <ul className="mt-3 divide-y divide-white/10">
                  {logs.map((log) => {
                    const performer =
                      log.performer ? userLabel(log.performer) : "Unknown member";
                    const msg = detailsMessage(log.details);
                    const line = msg
                      ? msg
                      : `${performer} ${log.action_type.replaceAll("_", " ").toLowerCase()}`;

                    return (
                      <li key={log.id} className="py-2">
                        <p className="text-sm text-[#E3E3E3]">{line}</p>
                        <p className="mt-0.5 text-xs text-[#C4C7C5]">
                          {formatDate(log.timestamp)}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </MaterialCard>
          ) : null}

          {tab === "team" ? (
            <MemberList
              tripId={tripId}
              creatorId={trip.creator_id}
              currentUserId={user.id}
              members={trip.members}
            />
          ) : null}

          {tab === "settings" ? (
            <MaterialCard>
              <div className="space-y-1">
                <h2 className="text-base font-semibold tracking-tight">Settings</h2>
                <p className="text-sm text-[#C4C7C5]">Trip metadata (read-only).</p>
              </div>

              <dl className="mt-4 grid gap-3">
                <div>
                  <dt className="text-xs text-[#C4C7C5]">Destination</dt>
                  <dd className="text-sm">{trip.destination}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[#C4C7C5]">Dates</dt>
                  <dd className="text-sm">
                    {formatDate(trip.start_date)} → {formatDate(trip.end_date)}
                  </dd>
                </div>
                {trip.notes ? (
                  <div>
                    <dt className="text-xs text-[#C4C7C5]">Notes</dt>
                    <dd className="whitespace-pre-wrap text-sm text-[#E3E3E3]">{trip.notes}</dd>
                  </div>
                ) : null}
              </dl>

              <InviteLinkButton tripId={tripId} />
            </MaterialCard>
          ) : null}
          </TripTabContentPending>
        </div>

      {showFab ? (
        // Perf: mount AddExpenseModal once; position it responsively.
        <div className="fixed bottom-6 right-6 z-50 md:static md:col-span-4 md:flex md:justify-end md:self-start">
          <AddExpenseModal
            tripId={tripId}
            currentUserId={user.id}
            members={membersForModal}
            triggerVariant="filled"
            triggerLabel={
              <>
                <Plus className="h-5 w-5" />
                <span className="sr-only">Add expense</span>
              </>
            }
            triggerClassName="h-14 w-14 rounded-full p-0"
          />
        </div>
      ) : null}
      </div>
    </TripTabTransitionProvider>
  );
}
