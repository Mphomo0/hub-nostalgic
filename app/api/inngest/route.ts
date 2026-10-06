import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { functions } from "@/lib/inngest/functions";

// Background job endpoint. Inngest calls this to run our functions.
export const { GET, POST, PUT } = serve({ client: inngest, functions });

// Reminder runs loop over many requests; allow time.
export const maxDuration = 300;
