import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { isModuleKey, MODULES, type ModuleKey } from "@/modules/catalog";

/** Module keys switched on for a client, in catalog order. Cached per request. */
export const getEnabledModules = cache(async (clientId: string): Promise<ModuleKey[]> => {
  const rows = await db.clientModule.findMany({ where: { clientId }, select: { module: true } });
  const keys = new Set(rows.map((r) => r.module));
  return MODULES.map((m) => m.key).filter((k): k is ModuleKey => keys.has(k) && isModuleKey(k));
});

export async function hasModule(clientId: string, key: ModuleKey) {
  return (await getEnabledModules(clientId)).includes(key);
}
