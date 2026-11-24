export type MotifFile = { role: string; name: string; path: string };

function stem(name: string): string {
  return name.replace(/\.[a-z0-9]+$/i, "").toLowerCase();
}

const BRAND_WORDS = new Set(["samsung", "galaxy", "google", "pixel", "apple", "iphone"]);

function fold(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

/** „A57“, „Galaxy A57“ and „Samsung A57“ all hit the same device file. */
export function motifQueryMatches(name: string, query: string): boolean {
  const hay = fold(name);
  const words = fold(query).split(/\s+/).filter(Boolean);
  const tokens = words.filter((word) => !BRAND_WORDS.has(word));
  const needles = tokens.length ? tokens : words;
  return needles.length > 0 && needles.every((token) => hay.includes(token));
}

/** The file whose name matches the requested motif. Never substitutes a different person. */
export function resolveMotif(files: readonly MotifFile[], query: string, role: string): MotifFile {
  const needle = query.trim().toLowerCase().replace(/\.[a-z0-9]+$/i, "");
  if (!needle) throw new Error("Das Motiv fehlt. Nenne den Dateinamen.");
  const pool = files.filter((file) => file.role === role);
  const exact = pool.filter((file) => stem(file.name) === needle || file.name.toLowerCase() === query.trim().toLowerCase());
  const matches = exact.length ? exact : pool.filter((file) => stem(file.name).includes(needle) || motifQueryMatches(file.name, needle));
  if (matches.length === 1) return matches[0];
  if (!matches.length) throw new Error(`Kein Motiv „${query.trim()}“ in den Dateien für ${role}.`);
  throw new Error(`Mehrere Dateien passen zu „${query.trim()}“: ${matches.slice(0, 5).map((file) => file.name).join(", ")}. Nenne den Dateinamen.`);
}
