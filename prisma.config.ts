import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  // NOTE: Prisma CLI always loads prisma.config.ts, but not every command needs a DB URL.
  // Using process.env directly avoids hard-failing commands like `prisma generate` in CI.
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
});
