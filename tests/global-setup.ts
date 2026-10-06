import "dotenv/config";
import { execSync } from "node:child_process";

/**
 * Tests TRUNCATE every table, so they must run against a throwaway database.
 * Set TEST_DATABASE_URL to a separate database (locally: `npx prisma dev -n nostalgic-test`).
 * We refuse to run if it's missing or the same as DATABASE_URL.
 */
export default async function setup() {
  const testUrl = process.env.TEST_DATABASE_URL;
  if (!testUrl) throw new Error("Set TEST_DATABASE_URL to a separate, throwaway database before running tests.");
  if (testUrl === process.env.DATABASE_URL || testUrl === process.env.DIRECT_URL) {
    throw new Error("TEST_DATABASE_URL must not be the same as DATABASE_URL: tests delete all data.");
  }
  execSync("npx prisma migrate deploy", { stdio: "inherit", env: { ...process.env, DATABASE_URL: testUrl, DIRECT_URL: testUrl } });
}
