import { TIMEZONE } from "@/lib/config";
import { inngest } from "@/lib/inngest/client";
import { purgeExpiredData } from "@/lib/retention";
import { moduleJobs } from "@/modules/server";

/** Monthly POPIA clean-up of data past the retention period (platform-wide). */
export const monthlyRetention = inngest.createFunction(
  { id: "monthly-retention", triggers: [{ cron: `TZ=${TIMEZONE} 0 3 1 * *` }], retries: 2 },
  async ({ step }) => step.run("purge", () => purgeExpiredData()),
);

/** Every background job: platform jobs plus each module's jobs. Served at /api/inngest. */
export const functions = [monthlyRetention, ...moduleJobs];
