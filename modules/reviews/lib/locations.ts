import { db } from "@/lib/db";

/** Name shown to customers: "Business – Branch" when a client has several branches, else just the business. */
export function branchLabel(clientName: string, location: { name: string } | null | undefined, branchCount: number) {
  if (!location || branchCount < 2 || location.name === clientName) return clientName;
  return location.name.startsWith(clientName) ? location.name : `${clientName} – ${location.name}`;
}

/** A client's branches, oldest first. */
export function listLocations(clientId: string) {
  return db.reviewLocation.findMany({ where: { clientId }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, googleReviewUrl: true } });
}

/**
 * Pick the branch for a send. A client with one branch needs no choice; with
 * several, the caller must say which. Returns null if the id isn't theirs.
 */
export async function resolveLocation(clientId: string, locationId: string | undefined) {
  const locations = await db.reviewLocation.findMany({ where: { clientId }, orderBy: { createdAt: "asc" }, select: { id: true } });
  if (locationId) return locations.find((l) => l.id === locationId)?.id ?? null;
  return locations.length === 1 ? locations[0].id : null;
}

type LocationInput = { id?: string; name: string; googleReviewUrl: string };

/** Add a branch, or update one that belongs to this client. */
export async function saveLocation(clientId: string, input: LocationInput) {
  const { id, name, googleReviewUrl } = input;
  if (!id) {
    await db.reviewLocation.create({ data: { clientId, name, googleReviewUrl } });
    return { ok: true as const, message: "Branch added." };
  }
  const { count } = await db.reviewLocation.updateMany({ where: { id, clientId }, data: { name, googleReviewUrl } });
  return count ? { ok: true as const, message: "Branch saved." } : { ok: false as const, message: "That branch no longer exists." };
}

/**
 * Remove a branch. Refused when it is the last one (Reviews needs a link) or
 * when it already has requests (their history and Google link must survive).
 */
export async function deleteLocation(clientId: string, id: string) {
  const [total, used] = await Promise.all([
    db.reviewLocation.count({ where: { clientId } }),
    db.reviewRequest.count({ where: { clientId, locationId: id } }),
  ]);
  if (total <= 1) return { ok: false as const, message: "You need at least one branch." };
  if (used > 0) return { ok: false as const, message: "This branch already has review requests, so it can't be removed. Rename it instead." };
  const { count } = await db.reviewLocation.deleteMany({ where: { id, clientId } });
  return count ? { ok: true as const, message: "Branch removed." } : { ok: false as const, message: "That branch no longer exists." };
}
