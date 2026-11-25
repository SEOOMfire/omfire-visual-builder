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

export type MotifPick = { file: MotifFile; note?: string };

function angleLabel(name: string): string {
  const angle = name.match(/(?:^|[^0-9])(45|90|180)(?:[^0-9]|$)/);
  const model = name.match(/A\d{2}|S\d{2}|Pixel\s*\d+|iPhone[^_\s]*/i);
  const view = angle ? `${angle[1]}°` : "";
  return [model?.[0], view].filter(Boolean).join(" ") || name.replace(/\.[a-z0-9]+$/i, "");
}

/** The file whose name matches the requested motif. Several hits prefer the 45° view and ask. */
export function resolveMotif(files: readonly MotifFile[], query: string, role: string, preferred?: string): MotifPick {
  const needle = query.trim().toLowerCase().replace(/\.[a-z0-9]+$/i, "");
  if (!needle) throw new Error("Das Motiv fehlt. Nenne den Dateinamen.");
  const pool = files.filter((file) => file.role === role);
  const exact = pool.filter((file) => stem(file.name) === needle || file.name.toLowerCase() === query.trim().toLowerCase());
  const matches = exact.length ? exact : pool.filter((file) => stem(file.name).includes(needle) || motifQueryMatches(file.name, needle));
  if (matches.length === 1 && matches[0]) return { file: matches[0] };
  if (!matches.length) throw new Error(`Kein Motiv „${query.trim()}“ in den Dateien für ${role}.`);
  if (preferred) {
    const picked = matches.find((file) => new RegExp(`(?:^|[^0-9])${preferred}(?:[^0-9]|$)`).test(file.name));
    if (picked) return { file: picked };
  }
  const chosen = matches.find((file) => /(?:^|[^0-9])45(?:[^0-9]|$)/.test(file.name)) ?? matches[0];
  if (!chosen) throw new Error(`Kein Motiv „${query.trim()}“ in den Dateien für ${role}.`);
  const labels = [...new Set(matches.slice(0, 4).map((file) => angleLabel(file.name)))];
  return { file: chosen, note: `Meinst du ${labels.join(" oder ")}? Ich nehme 45°, wenn du nichts sagst.` };
}
