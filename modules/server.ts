import "server-only";
import type { ComponentType } from "react";
import type { ModuleKey } from "@/modules/catalog";
import { reviewJobs } from "@/modules/reviews/jobs";
import { ReviewsAdminPanel } from "@/modules/reviews/admin/panel";
import { ReviewsHomeCard } from "@/modules/reviews/components/home-card";

/**
 * Server-side hooks for each module (things that can't live in the plain-data
 * catalog): background jobs, the dashboard home card and the admin panel.
 * Add your module here when you create it.
 */

/** Every module's Inngest functions. */
export const moduleJobs = [...reviewJobs];

/** Summary card on /dashboard for each module (receives the client id). */
export const moduleHomeCards: Record<ModuleKey, ComponentType<{ clientId: string }>> = {
  reviews: ReviewsHomeCard,
};

/** Section on the admin client page for each module: switch on/off and module settings. */
export const moduleAdminPanels: Record<ModuleKey, ComponentType<{ clientId: string; enabled: boolean }>> = {
  reviews: ReviewsAdminPanel,
};
