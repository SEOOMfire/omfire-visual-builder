export type MotifFile = { role: string; name: string; path: string };

function stem(name: string): string {
  return name.replace(/\.[a-z0-9]+$/i, "").toLowerCase();
}

/** The file whose name matches the requested motif. Never substitutes a different person. */
export function resolveMotif(files: readonly MotifFile[], query: string, role: string): MotifFile {
  const needle = query.trim().toLowerCase().replace(/\.[a-z0-9]+$/i, "");
  if (!needle) throw new Error("Das Motiv fehlt. Nenne den Dateinamen.");
  const pool = files.filter((file) => file.role === role);
  const exact = pool.filter((file) => stem(file.name) === needle || file.name.toLowerCase() === query.trim().toLowerCase());
  const matches = exact.length ? exact : pool.filter((file) => stem(file.name).includes(needle));
  if (matches.length === 1) return matches[0];
  if (!matches.length) throw new Error(`Kein Motiv „${query.trim()}“ in den Dateien für ${role}.`);
  throw new Error(`Mehrere Dateien passen zu „${query.trim()}“: ${matches.slice(0, 5).map((file) => file.name).join(", ")}. Nenne den Dateinamen.`);
}
