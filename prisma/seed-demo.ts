/**
 * Demo client with realistic data, so you can see the dashboard after login.
 *
 *   npm run db:seed:demo
 *
 * Creates "Sunrise Hair Studio (demo)" with an owner and a staff login, ~45 days
 * of review requests, ratings, private feedback, opt-outs and usage.
 * Logins: demo-owner@example.com and demo-staff@example.com, password from
 * DEMO_PASSWORD in .env (a random one is generated and printed if it's empty).
 *
 * Safe to re-run: the demo client and logins are deleted and recreated.
 * Refuses to run in production unless ALLOW_DEMO_SEED=1.
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { auth } from "@/lib/auth";
import { monthKey } from "@/lib/dates";
import { db } from "@/lib/db";
import type { Channel, RequestStatus } from "@/lib/generated/prisma/client";
import { newToken } from "@/lib/tokens";

const CLIENT_NAME = "Sunrise Hair Studio (demo)";
const OWNER_EMAIL = "demo-owner@example.com";
const STAFF_EMAIL = "demo-staff@example.com";
const DAY = 24 * 60 * 60 * 1000;

const NAMES = [
  "Thandi Nkosi", "Pieter van Wyk", "Lerato Mokoena", "Sipho Dlamini", "Ayesha Patel", "Johan Botha", "Naledi Khumalo", "Bongani Zulu",
  "Fatima Adams", "Kagiso Molefe", "Megan Smith", "Tshepo Mahlangu", "Zanele Ndlovu", "Ruan Pretorius", "Palesa Mabaso", "Mandla Sithole",
  "Chantelle Jacobs", "Lwazi Mthembu", "Nomvula Shabalala", "Imraan Essop", "Karabo Sello", "Annelie du Plessis", "Themba Ngcobo", "Refilwe Tau",
  "Grace Williams", "Mpho Radebe", "Yusuf Cassim", "Busisiwe Mkhize", "Neo Mokoena", "Charlene Petersen", "Andile Cele", "Lindiwe Hadebe",
  "Riaan Venter", "Ntombi Gumede", "Tumelo Phiri", "Shirley Naidoo", "Kabelo Nkuna", "Ilse Steyn", "Sizwe Buthelezi", "Dineo Masilela",
  "Hannah Govender", "Vusi Maseko",
];

const FEEDBACK = [
  "I waited almost 40 minutes past my booking time. The cut was fine but nobody said sorry.",
  "The colour came out much darker than we discussed. Could someone call me?",
  "Music was very loud and it was hard to talk to my stylist.",
  "I was charged more than the price on your website.",
  "Nice people but the salon felt rushed on a Saturday morning.",
];

// Small deterministic random generator so every run looks the same.
let seed = 42;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);

/** Mostly happy customers, a few unhappy ones (roughly what a good salon sees). */
function randomRating() {
  const r = rand();
  return r < 0.62 ? 5 : r < 0.9 ? 4 : r < 0.96 ? 3 : r < 0.99 ? 2 : 1;
}

async function demoLogo() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="240">
    <rect width="800" height="240" fill="#ffffff"/>
    <circle cx="120" cy="120" r="70" fill="#d9822b"/>
    <text x="230" y="140" font-family="Georgia, serif" font-size="78" font-weight="700" fill="#5a2e0e">Sunrise</text>
    <text x="236" y="190" font-family="Helvetica, Arial, sans-serif" font-size="30" letter-spacing="10" fill="#9a6b45">HAIR STUDIO</text>
  </svg>`;
  const data = await sharp(Buffer.from(svg)).resize({ width: 400 }).webp({ quality: 85 }).toBuffer();
  return { data: new Uint8Array(data), contentType: "image/webp", sizeBytes: data.length };
}

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_SEED !== "1") {
    throw new Error("Refusing to seed demo data in production. Set ALLOW_DEMO_SEED=1 if you really mean it.");
  }

  // Start fresh: remove any previous demo client and logins.
  await db.client.deleteMany({ where: { name: CLIENT_NAME } });
  await db.user.deleteMany({ where: { email: { in: [OWNER_EMAIL, STAFF_EMAIL] } } });

  const password = process.env.DEMO_PASSWORD || randomBytes(9).toString("base64url");
  const ctx = await auth.$context;
  const hash = await ctx.password.hash(password);

  const client = await db.client.create({
    data: {
      name: CLIENT_NAME,
      brandColor: "#b4581c",
      contactEmail: OWNER_EMAIL,
      contactPhone: "+27215550101",
      logo: { create: await demoLogo() },
      modules: { create: [{ module: "reviews" }] },
      reviewSettings: { create: { googleReviewUrl: "https://g.page/r/sunrise-hair-studio-demo/review" } },
    },
  });

  const makeLogin = async (email: string, name: string, role: "OWNER" | "STAFF") => {
    const user = await db.user.create({ data: { email, name, emailVerified: true } });
    await db.account.create({ data: { userId: user.id, accountId: user.id, providerId: "credential", password: hash } });
    await db.membership.create({ data: { userId: user.id, clientId: client.id, role } });
    return user;
  };
  const owner = await makeLogin(OWNER_EMAIL, "Sarah Daniels", "OWNER");
  const staff = await makeLogin(STAFF_EMAIL, "Kyle Abrahams", "STAFF");
  await db.invite.create({
    data: { clientId: client.id, email: "nomsa.reception@example.com", name: "Nomsa (reception)", role: "STAFF", tokenHash: randomBytes(32).toString("hex"), expiresAt: new Date(Date.now() + 5 * DAY), invitedByUserId: owner.id },
  });

  const now = Date.now();
  const usage = new Map<string, { whatsappCount: number; emailCount: number }>();
  const count = (date: Date, channel: Channel) => {
    const key = monthKey(date);
    const u = usage.get(key) ?? { whatsappCount: 0, emailCount: 0 };
    if (channel === "WHATSAPP") u.whatsappCount++;
    else u.emailCount++;
    usage.set(key, u);
  };

  for (const [i, name] of NAMES.entries()) {
    const first = name.split(" ")[0].toLowerCase();
    const hasPhone = rand() < 0.75;
    const hasEmail = !hasPhone || rand() < 0.5;
    const customer = await db.customer.create({
      data: {
        clientId: client.id,
        name,
        phoneE164: hasPhone ? `+2782555${String(1000 + i).slice(-4)}` : null,
        email: hasEmail ? `${first}.${i}@example.com` : null,
        optedOutAt: i === 7 || i === 23 ? new Date(now - (10 + i) * DAY) : null,
      },
    });

    const sender = rand() < 0.65 ? owner : staff;
    const consent = await db.consentLog.create({
      data: { clientId: client.id, userId: sender.id, batchLabel: rand() < 0.4 ? "CSV upload: week.csv" : "Manual send", statementVersion: "2026-10-v1", ip: "196.25.1.1" },
    });

    const daysAgo = Math.floor(rand() * 45);
    const sentAt = new Date(now - daysAgo * DAY - Math.floor(rand() * 8) * 60 * 60 * 1000);
    const channel: Channel = customer.phoneE164 ? "WHATSAPP" : "EMAIL";

    // Decide how far this customer got.
    let status: RequestStatus = "SENT";
    let rating: number | null = null;
    let openedAt: Date | null = null;
    let ratedAt: Date | null = null;
    let googleClickedAt: Date | null = null;
    let reminderSentAt: Date | null = null;
    let failureReason: string | null = null;

    const r = rand();
    // A few fixed unhappy customers so the feedback inbox always has something in it.
    const forcedLow: Record<number, number> = { 4: 2, 12: 3, 27: 3 };
    if (forcedLow[i]) {
      rating = forcedLow[i];
      openedAt = new Date(sentAt.getTime() + 2 * 60 * 60 * 1000);
      ratedAt = new Date(openedAt.getTime() + 60 * 1000);
      status = i === 12 ? "CLICKED_GOOGLE" : "RATED";
      if (status === "CLICKED_GOOGLE") googleClickedAt = new Date(ratedAt.getTime() + 30 * 1000);
    } else if (i === 31) {
      status = "FAILED";
      failureReason = "WhatsApp: message undeliverable";
    } else if (daysAgo === 0 && r < 0.5) {
      status = "QUEUED";
    } else if (r < 0.7) {
      rating = randomRating();
      openedAt = new Date(sentAt.getTime() + (1 + rand() * 20) * 60 * 60 * 1000);
      ratedAt = new Date(openedAt.getTime() + 60 * 1000);
      status = "RATED";
      // Most happy customers click through to Google; some unhappy ones still do.
      if ((rating >= 4 && rand() < 0.8) || (rating <= 3 && rand() < 0.3)) {
        googleClickedAt = new Date(ratedAt.getTime() + 30 * 1000);
        status = "CLICKED_GOOGLE";
      }
    } else if (r < 0.82) {
      status = "OPENED";
      openedAt = new Date(sentAt.getTime() + 5 * 60 * 60 * 1000);
    }
    if (status !== "QUEUED" && status !== "FAILED" && rating === null && daysAgo >= 3) {
      reminderSentAt = new Date(sentAt.getTime() + 3 * DAY);
    }

    const req = await db.reviewRequest.create({
      data: {
        clientId: client.id,
        customerId: customer.id,
        sentByUserId: sender.id,
        channel,
        token: newToken(),
        status,
        rating,
        failureReason,
        sentAt: status === "QUEUED" || status === "FAILED" ? null : sentAt,
        openedAt,
        ratedAt,
        googleClickedAt,
        reminderSentAt,
        consentLogId: consent.id,
        createdAt: sentAt,
      },
    });

    if (status !== "QUEUED" && status !== "FAILED") count(sentAt, channel);
    if (reminderSentAt) count(reminderSentAt, channel);

    if (rating !== null && rating <= 3 && (forcedLow[i] || rand() < 0.8)) {
      // Forced ones stay open (except one), so there's something to handle.
      const handled = forcedLow[i] ? i === 27 : rand() < 0.5;
      await db.feedback.create({
        data: {
          reviewRequestId: req.id,
          message: FEEDBACK[i % FEEDBACK.length],
          createdAt: new Date(ratedAt!.getTime() + 2 * 60 * 1000),
          handledAt: handled ? new Date(ratedAt!.getTime() + DAY) : null,
          handledByUserId: handled ? owner.id : null,
        },
      });
    }
  }

  for (const [month, u] of usage) {
    await db.usageCounter.create({ data: { clientId: client.id, month, ...u } });
  }

  const total = await db.reviewRequest.count({ where: { clientId: client.id } });
  console.log(`✔ Demo client "${CLIENT_NAME}" with ${total} review requests`);
  console.log(`  Owner login: ${OWNER_EMAIL}`);
  console.log(`  Staff login: ${STAFF_EMAIL}`);
  console.log(process.env.DEMO_PASSWORD ? "  Password: the DEMO_PASSWORD value in .env" : `  Password (generated, set DEMO_PASSWORD to fix it): ${password}`);
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
