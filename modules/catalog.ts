import { reviewsModule } from "@/modules/reviews/module";
import type { ModuleDefinition } from "@/modules/types";

/**
 * Every product module on the platform, in menu order.
 *
 * To add a module (e.g. invoicing):
 *   1. Create modules/invoicing/ with a module.ts like modules/reviews/module.ts
 *   2. Add it to this list
 *   3. Add its tables in prisma/schema/invoicing.prisma (and tenant scopes in lib/tenant.ts)
 *   4. Add its pages under app/dashboard/invoicing/ and guard them with requireModule("invoicing")
 *   5. Register its background jobs and home card in modules/server.ts
 * See README → "Adding a module".
 */
export const MODULES: readonly ModuleDefinition[] = [reviewsModule];

export type ModuleKey = (typeof MODULES)[number]["key"];

export function getModule(key: string) {
  return MODULES.find((m) => m.key === key);
}

export function isModuleKey(key: string): key is ModuleKey {
  return MODULES.some((m) => m.key === key);
}

/** Modules that can be switched on for clients right now. */
export const AVAILABLE_MODULES = MODULES.filter((m) => m.status === "available");
