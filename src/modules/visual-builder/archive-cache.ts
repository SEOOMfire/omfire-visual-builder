import type { ArchiveEntry } from "./types";

/** Drops a confirmed deletion from the local list at once, so no stale card invites a second request. */
export function removeArchivedCreative(entries: readonly ArchiveEntry[] | null, id: string): ArchiveEntry[] | null {
  return entries ? entries.filter((entry) => entry.id !== id) : null;
}
