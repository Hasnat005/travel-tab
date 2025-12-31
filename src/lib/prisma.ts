import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function getDatasourceUrl() {
  return (
    process.env.DATABASE_URL ||
    process.env.DATABASE_MIGRATION_URL ||
    process.env.DATABASE_DIRECT_URL ||
    ""
  );
}

function createAdapter() {
  const connectionString = getDatasourceUrl();
  if (!connectionString) {
    throw new Error(
      "Missing database connection string. Set DATABASE_URL (or DATABASE_MIGRATION_URL / DATABASE_DIRECT_URL)."
    );
  }
  return new PrismaPg({ connectionString });
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: createAdapter(),
    // Consider enabling query logs during debugging:
    // log: ["query", "info", "warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
