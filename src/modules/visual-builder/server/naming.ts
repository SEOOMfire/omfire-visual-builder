import type { Fmt } from "../types";

const UMLAUT: Record<string, string> = { ä: "ae", ö: "oe", ü: "ue", ß: "ss", Ä: "Ae", Ö: "Oe", Ü: "Ue" };

/** Lowercase slug piece: umlauts spelled out, hyphens inside a word, nothing else. */
export function namePart(value: string): string {
  const folded = value.normalize("NFC").replace(/[äöüÄÖÜß]/g, (char) => UMLAUT[char] ?? char);
  return folded.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function motifPart(filename: string): string {
  const base = filename.split("/").pop() ?? filename;
  const withoutExt = base.replace(/\.[a-z0-9]+$/i, "");
  return namePart(withoutExt);
}

export function formatToken(format: Fmt): "1080x1080" | "1200x628" | "1080x1920" {
  if (format === "1x1") return "1080x1080";
  if (format === "191x1") return "1200x628";
  return "1080x1920";
}

export function formatFromToken(token: string): Fmt | null {
  if (token === "1080x1080") return "1x1";
  if (token === "1200x628") return "191x1";
  if (token === "1080x1920") return "1x191";
  return null;
}

export type NameInput = {
  client: string;
  campaign: string;
  motif: string;
  format: Fmt;
  language: string;
  version: number;
};

export function outputFolder(campaign: string, when = new Date()): string {
  const part = namePart(campaign);
  if (!part) throw new Error("Die Kampagne fehlt. Nenne sie, dann kann ich ablegen.");
  const month = `${when.getUTCFullYear()}-${String(when.getUTCMonth() + 1).padStart(2, "0")}`;
  return `ausgabe/${part}/${month}`;
}

export function creativeFileName(input: NameInput): string {
  const version = String(input.version).padStart(2, "0");
  const pieces = [namePart(input.client), namePart(input.campaign), motifPart(input.motif), formatToken(input.format), namePart(input.language)];
  if (pieces.some((piece) => !piece)) throw new Error("Für den Dateinamen fehlen Kunde, Kampagne, Motiv oder Sprache.");
  return `${pieces.join("_")}_v${version}.png`;
}

export function zipFileName(input: Omit<NameInput, "format">): string {
  const version = String(input.version).padStart(2, "0");
  const pieces = [namePart(input.client), namePart(input.campaign), motifPart(input.motif), namePart(input.language)];
  if (pieces.some((piece) => !piece)) throw new Error("Für den Dateinamen fehlen Kunde, Kampagne, Motiv oder Sprache.");
  return `${pieces.join("_")}_v${version}.zip`;
}

/** Next free version. Existing names may be paths; only the file name is compared. Never returns a used number. */
export function nextVersion(existing: readonly string[], stem: string): number {
  const pattern = new RegExp(`^${stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}_v(\\d+)\\.[a-z0-9]+$`, "i");
  let highest = 0;
  for (const name of existing) {
    const file = name.split("/").pop() ?? name;
    const match = pattern.exec(file);
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  return highest + 1;
}
