import type { GuidelineStatus } from "./types";

/**
 * Result of the guideline check for the current text: "none" until the exact text was checked,
 * "approved" without findings, "flagged" with findings or when the check could not run.
 */
export type CheckOutcome = "none" | "approved" | "flagged";

export function guidelineOutcome(checkedText: string | null, currentText: string, checkId: string | null, approved: boolean): CheckOutcome {
  if (checkId === null || checkedText === null || checkedText !== currentText) return "none";
  return approved ? "approved" : "flagged";
}

/** Downloading needs a check of the current text; a flagged result still downloads, marked as not signed off. */
export function canDownloadCreative(outcome: CheckOutcome): boolean {
  return outcome !== "none";
}

/** Entries taken over from the previous tool have no status and keep their download; unchecked drafts have none. */
export function canDownloadArchivedCreative(status: GuidelineStatus): boolean {
  return status !== "draft";
}
