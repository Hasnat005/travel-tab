import { defineConfig } from "prisma/config";
import dotenv from "dotenv";

// Prisma CLI loads this file for every command.
// Next.js commonly uses `.env.local`, but `dotenv/config` only loads `.env` by default.
dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ quiet: true });

const migrationUrl = process.env.DATABASE_MIGRATION_URL;
const directUrl = process.env.DATABASE_DIRECT_URL;
const defaultUrl = process.env.DATABASE_URL;

const datasourceUrl = migrationUrl ?? directUrl ?? defaultUrl ?? "";
const shadowUrlRaw = process.env.SHADOW_DATABASE_URL;
const shadowDatabaseUrl =
  shadowUrlRaw && shadowUrlRaw !== datasourceUrl ? shadowUrlRaw : undefined;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  // NOTE: Prisma CLI always loads prisma.config.ts, but not every command needs a DB URL.
  // For build/generate commands, provide a dummy URL if none exists.
  datasource: datasourceUrl ? {
    url: datasourceUrl,
    shadowDatabaseUrl,
  } : {
    url: "postgresql://dummy:dummy@localhost:5432/dummy",
  },
});
