// Prisma CLI configuration (migrations, studio, etc.).
// The app itself connects via lib/db.ts using a driver adapter.
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Migrations need a direct (non-pooled) connection on Neon.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  },
});
