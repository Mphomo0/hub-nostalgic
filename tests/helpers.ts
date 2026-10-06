import { db } from "@/lib/db";

/** Wipe all app tables between tests. */
export async function resetDb() {
  await db.$executeRawUnsafe(`TRUNCATE TABLE
    "message_event","feedback","review_request","consent_log","usage_counter","customer",
    "invite","membership","client_logo","client_module","review_settings","client","session","account","verification","user","enquiry"
    RESTART IDENTITY CASCADE`);
}

let n = 0;
export const TEST_GOOGLE_URL = "https://g.page/r/example/review";

/** Create a client with an owner login. Reviews is switched on unless modules says otherwise. */
export async function makeClient(
  overrides: { name?: string; status?: "ACTIVE" | "PAUSED"; monthlyCap?: number | null; remindersEnabled?: boolean; modules?: string[] } = {},
) {
  n += 1;
  const modules = overrides.modules ?? ["reviews"];
  const client = await db.client.create({
    data: {
      name: overrides.name ?? `Client ${n}`,
      status: overrides.status ?? "ACTIVE",
      monthlyCap: overrides.monthlyCap ?? null,
      modules: { create: modules.map((module) => ({ module })) },
      reviewSettings: { create: { googleReviewUrl: TEST_GOOGLE_URL, remindersEnabled: overrides.remindersEnabled ?? true } },
    },
  });
  const user = await db.user.create({ data: { email: `owner${n}-${Date.now()}@example.com`, name: `Owner ${n}`, emailVerified: true } });
  await db.membership.create({ data: { userId: user.id, clientId: client.id, role: "OWNER" } });
  return { client, user };
}
