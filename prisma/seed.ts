/**
 * Seeds the first platform admin (Nostalgic Studio).
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=... npm run db:seed
 * Safe to run more than once: an existing user is just promoted to admin.
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!email) throw new Error("Set ADMIN_EMAIL in .env first");

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    await db.user.update({ where: { id: existing.id }, data: { isPlatformAdmin: true } });
    console.log(`✔ ${email} is a platform admin (existing account, password unchanged).`);
    return;
  }

  const password = process.env.ADMIN_PASSWORD || randomBytes(12).toString("base64url");
  const ctx = await auth.$context;
  const hash = await ctx.password.hash(password);
  await db.$transaction(async (tx) => {
    const user = await tx.user.create({ data: { email, name: "Platform admin", emailVerified: true, isPlatformAdmin: true } });
    await tx.account.create({ data: { userId: user.id, accountId: user.id, providerId: "credential", password: hash } });
  });
  console.log(`✔ Created platform admin ${email}`);
  if (!process.env.ADMIN_PASSWORD) console.log(`  Generated password: ${password}\n  Log in and keep it somewhere safe.`);
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
