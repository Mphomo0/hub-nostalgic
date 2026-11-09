import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { captcha } from "better-auth/plugins";
import { appUrl } from "@/lib/config";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/messaging/email";
import { passwordResetEmail } from "@/lib/messaging/templates";
import { authRateLimitStorage } from "@/lib/rate-limit";
import { expectedTurnstileAction, TURNSTILE_SECRET_KEY } from "@/lib/turnstile";

/**
 * Better Auth handles passwords, sessions and login rate limiting.
 *
 * Accounts are never created through public sign-up: the admin creates a client,
 * an invite email is sent, and the invite page creates the login (see lib/invites.ts).
 * Client membership and roles live in our own Membership table (lib/session.ts).
 */
export const auth = betterAuth({
  baseURL: process.env.APP_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(db, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 10,
    // Forgot password: the email links to our own /reset-password page.
    // Better Auth makes the token single-use and returns the same response
    // whether or not the email exists.
    resetPasswordTokenExpiresIn: 60 * 60, // 1 hour
    revokeSessionsOnPasswordReset: true, // log out every device after a reset
    sendResetPassword: async ({ user, token }) => {
      const mail = passwordResetEmail({ name: user.name, resetUrl: appUrl(`/reset-password?token=${encodeURIComponent(token)}`), expiresMinutes: 60 });
      await sendEmail({ to: user.email, ...mail });
    },
  },
  user: {
    additionalFields: {
      // input: false → can never be set through the auth API.
      isPlatformAdmin: { type: "boolean", defaultValue: false, input: false },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 14, // 14 days
    updateAge: 60 * 60 * 24, // refresh daily
  },
  rateLimit: {
    enabled: process.env.DISABLE_RATE_LIMIT !== "1",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 10 },
      "/request-password-reset": { window: 60 * 10, max: 5 },
      "/reset-password": { window: 60 * 10, max: 10 },
    },
    customStorage: authRateLimitStorage,
  },
  advanced: {
    database: { generateId: "uuid" },
  },
  plugins: [
    // Cloudflare Turnstile on login and forgot-password requests from the browser
    // (the client sends the token in the x-captcha-response header). Only HTTP
    // requests are checked; server-side auth.api calls (e.g. invite sign-in) are not.
    ...(TURNSTILE_SECRET_KEY
      ? [captcha({ provider: "cloudflare-turnstile", secretKey: TURNSTILE_SECRET_KEY, endpoints: ["/sign-in/email", "/request-password-reset"], expectedAction: expectedTurnstileAction("auth") })]
      : []),
    // Must be last: lets server actions set auth cookies.
    nextCookies(),
  ],
});

export type AuthSession = typeof auth.$Infer.Session;
