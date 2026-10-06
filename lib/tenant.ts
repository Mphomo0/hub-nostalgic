import { db } from "@/lib/db";

/**
 * Tenant-scoped database access (multi-tenancy rule, build plan section 5).
 *
 * `tenantDb(clientId)` returns a Prisma client that automatically adds
 * `clientId = <id>` to every query on tenant-owned tables:
 *   - reads/updates/deletes get the filter added to `where`
 *   - creates get `clientId` written into `data` (overriding anything passed in)
 *
 * The clientId must ALWAYS come from the logged-in user's session on the server
 * (see requireMember in lib/session.ts), never from the browser.
 * Dashboard code should use this helper instead of importing `db` directly.
 */

// Models that have a clientId column. Add each new module's tables here.
const DIRECT = new Set([
  // Platform
  "Customer", "ConsentLog", "UsageCounter", "Membership", "Invite", "ClientLogo", "ClientModule",
  // Reviews module
  "ReviewRequest", "ReviewSettings",
]);
// Models that belong to a tenant through a review request (Reviews module).
const VIA_REQUEST = new Set(["Feedback", "MessageEvent"]);

const READ_OPS = new Set([
  "findUnique", "findUniqueOrThrow", "findFirst", "findFirstOrThrow", "findMany",
  "count", "aggregate", "groupBy", "update", "updateMany", "updateManyAndReturn",
  "delete", "deleteMany",
]);
const CREATE_OPS = new Set(["create", "createMany", "createManyAndReturn"]);

export class TenancyError extends Error {}

function scopeFilter(model: string, clientId: string): Record<string, unknown> | null {
  if (DIRECT.has(model)) return { clientId };
  if (VIA_REQUEST.has(model)) return { reviewRequest: { clientId } };
  if (model === "Client") return { id: clientId };
  if (model === "User") return { memberships: { some: { clientId } } };
  return null;
}

export function tenantDb(clientId: string) {
  if (!clientId) throw new TenancyError("tenantDb requires a clientId");

  return db.$extends({
    name: "tenant-scope",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const filter = scopeFilter(model, clientId);
          if (!filter) throw new TenancyError(`Model ${model} is not tenant-scoped; use db directly in admin code`);
          const a = (args ?? {}) as Record<string, unknown>;

          if (READ_OPS.has(operation)) {
            // Keep the caller's where (findUnique needs its unique field at the
            // top level) and AND the tenant filter onto it.
            const where = (a.where ?? {}) as Record<string, unknown>;
            const existingAnd = where.AND ? (Array.isArray(where.AND) ? where.AND : [where.AND]) : [];
            a.where = { ...where, AND: [...existingAnd, filter] };
          } else if (CREATE_OPS.has(operation)) {
            if (!DIRECT.has(model)) throw new TenancyError(`Create on ${model} is not allowed through tenantDb`);
            // Drop any `client: { connect }` the caller passed and force our clientId.
            const withClient = (d: Record<string, unknown>) => {
              const rest = { ...d };
              delete rest.client;
              return { ...rest, clientId };
            };
            a.data = Array.isArray(a.data) ? a.data.map(withClient) : withClient(a.data as Record<string, unknown>);
          } else if (operation === "upsert") {
            if (!DIRECT.has(model)) throw new TenancyError(`Upsert on ${model} is not allowed through tenantDb`);
            const where = (a.where ?? {}) as Record<string, unknown>;
            a.where = { ...where, AND: [filter] };
            a.create = { ...(a.create as object), clientId };
          } else {
            throw new TenancyError(`Operation ${operation} on ${model} is not supported through tenantDb`);
          }
          return query(a as typeof args);
        },
      },
    },
  });
}

export type TenantDb = ReturnType<typeof tenantDb>;
