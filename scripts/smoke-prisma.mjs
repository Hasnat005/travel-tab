import dotenv from "dotenv";
import crypto from "node:crypto";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ quiet: true });

// Prisma Client defaults to DATABASE_URL. Prefer a migration-specific URL when present.
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  process.env.DATABASE_MIGRATION_URL ||
  process.env.DATABASE_DIRECT_URL ||
  "";

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const datasourceUrl =
  process.env.DATABASE_MIGRATION_URL ||
  process.env.DATABASE_URL ||
  process.env.DATABASE_DIRECT_URL ||
  "";

if (!datasourceUrl) {
  throw new Error(
    "No database URL set. Provide DATABASE_MIGRATION_URL and/or DATABASE_URL in .env.local."
  );
}

const adapter = new PrismaPg({ connectionString: datasourceUrl });
const prisma = new PrismaClient({ adapter });

const now = new Date();
const suffix = crypto.randomBytes(6).toString("hex");

async function main() {
  const userEmail = `smoke-${suffix}@example.com`;

  const user = await prisma.user.create({
    data: {
      email: userEmail,
      name: "Smoke Tester",
    },
  });

  const trip = await prisma.trip.create({
    data: {
      creator_id: user.id,
      name: "Bali 2025",
      destination: "Bali",
      start_date: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      end_date: new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.tripMember.create({
    data: {
      trip_id: trip.id,
      user_id: user.id,
    },
  });

  const expense = await prisma.expense.create({
    data: {
      trip_id: trip.id,
      description: "Airport taxi",
      total_amount: "120.00",
      date: now,
    },
  });

  await prisma.expensePayer.create({
    data: {
      expense_id: expense.id,
      user_id: user.id,
      amount_paid: "120.00",
    },
  });

  await prisma.expenseShare.create({
    data: {
      expense_id: expense.id,
      user_id: user.id,
      amount_owed: "120.00",
    },
  });

  await prisma.tripLog.create({
    data: {
      trip_id: trip.id,
      action_type: "EXPENSE_CREATED",
      performed_by: user.id,
      details: {
        expenseId: expense.id,
        description: expense.description,
      },
      timestamp: now,
    },
  });

  const tripWithRelations = await prisma.trip.findUnique({
    where: { id: trip.id },
    include: {
      creator: { select: { id: true, email: true } },
      members: { include: { user: { select: { id: true, email: true } } } },
      expenses: {
        include: {
          payers: { include: { user: { select: { id: true, email: true } } } },
          shares: { include: { user: { select: { id: true, email: true } } } },
        },
      },
      logs: { include: { performer: { select: { id: true, email: true } } } },
    },
  });

  console.log(
    JSON.stringify(
      {
        created: {
          userId: user.id,
          tripId: trip.id,
          expenseId: expense.id,
        },
        query: tripWithRelations,
      },
      null,
      2
    )
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
