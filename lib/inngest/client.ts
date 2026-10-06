import { Inngest } from "inngest";

/**
 * Inngest runs our background jobs (send queue with retries, daily reminders).
 * Local dev: run `npx inngest-cli@latest dev` and set INNGEST_DEV=1.
 * Production: set INNGEST_EVENT_KEY and INNGEST_SIGNING_KEY (Vercel integration does this).
 */
export const inngest = new Inngest({ id: "review-platform" });

/** True when events can actually be delivered to Inngest. */
export function inngestEnabled() {
  return Boolean(process.env.INNGEST_EVENT_KEY || process.env.INNGEST_DEV);
}

// Event names are defined by each module (e.g. modules/reviews/events.ts),
// prefixed with the module key.
