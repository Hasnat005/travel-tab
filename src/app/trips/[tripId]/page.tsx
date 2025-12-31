import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import AddExpenseModal from "@/components/expenses/AddExpenseModal";
import MemberList from "@/components/trips/MemberList";
import { calculateTripDebts } from "@/lib/debt-calculator";
import MemberCardsWithDetail from "@/components/trips/MemberCardsWithDetail";
import MaterialCard from "@/components/ui/MaterialCard";
import { Plus } from "lucide-react";

function formatDate(d: Date) {
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      members: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
      expenses: {
        include: {
          // R6 prerequisite: include payers + shares.
          payers: { include: { user: { select: { id: true, name: true, email: true } } } },
          shares: true,
        },
        orderBy: { date: "desc" },
      },
      logs: {
        include: {
          performer: { select: { id: true, name: true, email: true } },
        },
        orderBy: { timestamp: "asc" },
      },
    },
  });

  if (!trip) {
    notFound();
  }

  const isMember = trip.members.some((m) => m.user_id === user.id);
  if (!isMember) {
    notFound();
  }

  const totalTripCost = trip.expenses.reduce(
    (sum, e) => sum + e.total_amount.toNumber(),
    0
  );

  // R6: Member Cards & Balances
  // paid = sum(payers.amount_paid), owed = sum(shares.amount_owed), net = paid - owed
  const paidCentsByUser = new Map<string, number>();
  const owedCentsByUser = new Map<string, number>();
  for (const m of trip.members) {
    paidCentsByUser.set(m.user_id, 0);
    owedCentsByUser.set(m.user_id, 0);
  }

  for (const e of trip.expenses) {
    for (const p of e.payers) {
      const prev = paidCentsByUser.get(p.user_id) ?? 0;
      paidCentsByUser.set(prev === undefined ? p.user_id : p.user_id, prev + toCents(p.amount_paid.toNumber()));
    }
    for (const s of e.shares) {
      const prev = owedCentsByUser.get(s.user_id) ?? 0;
      owedCentsByUser.set(prev === undefined ? s.user_id : s.user_id, prev + toCents(s.amount_owed.toNumber()));
    }
  }

  const memberBalances = trip.members.map((m) => {
    const paid = fromCents(paidCentsByUser.get(m.user_id) ?? 0);
    const owed = fromCents(owedCentsByUser.get(m.user_id) ?? 0);
    const net = Number((paid - owed).toFixed(2));
    return {
      user_id: m.user_id,
      name: m.user.name?.trim() ? m.user.name : null,
      email: m.user.email,
      paid,
      owed,
      net,
    };
  });

  // Serialize expenses for client-side member detail modal (no Decimal/Date across boundary).
  const clientExpenses = trip.expenses.map((e) => ({
    id: e.id,
    description: e.description,
    date: e.date.toISOString(),
    total_amount: e.total_amount.toNumber(),
    payers: e.payers.map((p) => ({
      user_id: p.user_id,
      amount_paid: p.amount_paid.toNumber(),
      user: { name: p.user.name, email: p.user.email },
    })),
    shares: e.shares.map((s) => ({
      user_id: s.user_id,
      amount_owed: s.amount_owed.toNumber(),
    })),
  }));

  // R9.4: Debt simplification / settlement plan
  const memberIds = trip.members.map((m) => m.user_id);
  const debtInputExpenses = trip.expenses.map((e) => ({
    id: e.id,
    payers: e.payers.map((p) => ({
      user_id: p.user_id,
      amount_paid: p.amount_paid.toNumber(),
    })),
    shares: e.shares.map((s) => ({
      user_id: s.user_id,
      amount_owed: s.amount_owed.toNumber(),
    })),
  }));

  const debtResult = calculateTripDebts(debtInputExpenses, memberIds);
  const settlements = debtResult.settlements;

  const memberLabelById = new Map(
    trip.members.map((m) => [m.user_id, m.user.name?.trim() || m.user.email])
  );

  const tabItems = [
    { key: "overview", label: "Overview" },
    { key: "expenses", label: "Expenses" },
    { key: "settlement", label: "Settlement" },
    { key: "team", label: "Team" },
    { key: "activity", label: "Activity" },
    { key: "settings", label: "Settings" },
  ] as const;

  const showFab = tab === "overview" || tab === "expenses";

  const membersForModal = trip.members.map((m) => ({
    id: m.user_id,
    name: m.user.name,
    email: m.user.email,
  }));

  return (
    <div className="-mx-4 -my-4 flex flex-col gap-6 p-4 md:-mx-6 md:-my-6 md:grid md:grid-cols-12 md:gap-8 md:p-8 lg:-mx-8 lg:-my-8">
      <div className="md:col-span-12">
        <MaterialCard>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{trip.name}</h1>
          <p className="text-sm text-[#C4C7C5]">
            {trip.destination} · {formatDate(trip.start_date)} → {formatDate(trip.end_date)}
          </p>
          <p className="pt-2 text-2xl font-semibold tabular-nums md:text-3xl">
            {formatCurrency(totalTripCost)}
          </p>
        </div>

        <div className="scrollbar-hide -mx-4 mt-5 overflow-x-auto px-4">
          <div className="flex w-max items-center gap-2 whitespace-nowrap">
            {tabItems.map((t) => {
              const active = tab === t.key;
              return (
                <Link
                  key={t.key}
                  href={`/trips/${tripId}?tab=${t.key}`}
                  className={
                    "inline-flex h-10 items-center justify-center rounded-full px-5 text-sm font-medium transition-colors " +
                    (active
                      ? "bg-[#333537] text-[#E3E3E3]"
                      : "bg-transparent text-[#C4C7C5] hover:bg-white/5 hover:text-[#E3E3E3]")
                  }
                >
                  {t.label}
                </Link>
              );
            })}
          </div>
        </div>
        </MaterialCard>
      </div>

      <div className="flex flex-col gap-6 md:col-span-8">
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
            </>
          ) : null}

          {tab === "expenses" ? (
            <MaterialCard>
              <div className="space-y-1">
                <h2 className="text-base font-semibold tracking-tight">Expenses</h2>
                <p className="text-sm text-[#C4C7C5]">A list of costs logged for this trip.</p>
              </div>

              {trip.expenses.length === 0 ? (
                <p className="mt-3 text-sm text-[#C4C7C5]">No expenses yet.</p>
              ) : (
                <div className="mt-4 grid gap-4">
                  {trip.expenses.map((e) => {
                    const payerNames = e.payers
                      .map((p) => p.user.name?.trim() || p.user.email)
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
                <ul className="mt-3 divide-y divide-white/10">
                  {settlements.map((s, idx) => {
                    const payer = memberLabelById.get(s.payer_id) ?? "Unknown member";
                    const payee = memberLabelById.get(s.payee_id) ?? "Unknown member";
                    return (
                      <li
                        key={`${s.payer_id}-${s.payee_id}-${idx}`}
                        className="flex items-center justify-between gap-4 py-2"
                      >
                        <p className="text-sm">
                          <span className="font-medium">{payer}</span> pays{" "}
                          <span className="font-medium">{payee}</span>
                        </p>
                        <p className="text-sm font-medium tabular-nums">
                          {formatCurrency(s.amount)}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </MaterialCard>
          ) : null}

          {tab === "activity" ? (
            <MaterialCard>
              <div className="space-y-1">
                <h2 className="text-base font-semibold tracking-tight">Trip Activity</h2>
                <p className="text-sm text-[#C4C7C5]">A chronological record of actions.</p>
              </div>

              {trip.logs.length === 0 ? (
                <p className="mt-3 text-sm text-[#C4C7C5]">No logs available.</p>
              ) : (
                <ul className="mt-3 divide-y divide-white/10">
                  {trip.logs.map((log) => {
                    const performer =
                      log.performer?.name?.trim() ||
                      log.performer?.email ||
                      "Unknown member";
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
            </MaterialCard>
          ) : null}
      </div>

      <div className="hidden md:block md:col-span-4">
        {showFab ? (
          <div className="flex justify-end">
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

      {showFab ? (
        <div className="fixed bottom-6 right-6 z-50 md:hidden">
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
  );
}
