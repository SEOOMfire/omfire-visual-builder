export type BatchRow = {
  line: number;
  channel: string;
  audience: string;
  campaign: string;
  motif: string;
  template: string;
  headline: string;
  subline: string;
  badge: string;
  languages: string[];
  formats: string[];
  nameExtra: string;
  logo: string;
  button: string;
  badgeTemplate: string;
  deviceName: string;
  energy: string;
  once: string;
  onceExtra: string;
  price: string;
  priceExtra: string;
  oldPrice: string;
  data: string;
  dataOld: string;
  star: string;
  deco: string;
};

const INTERNAL = /\b(sub\s*\d+|otc|cpc|cpa)\b/i;

function euro(value: string): number | undefined {
  const match = value.match(/\d{1,3}(?:\.\d{3})*(?:,\d+)?|\d+(?:\.\d+)?/);
  if (!match) return undefined;
  const raw = match[0].includes(",") ? match[0].replace(/\./g, "").replace(",", ".") : match[0];
  const number = Number(raw);
  return Number.isFinite(number) ? number : undefined;
}

export function inspectBatch(source: string): { rows: BatchRow[]; errors: string[] } {
  const parsed = parseBatchCsv(source);
  const errors = [...parsed.errors];
  for (const row of parsed.rows) {
    const text = [row.headline, row.subline, row.button, row.deviceName, row.star].join(" ");
    if (INTERNAL.test(text)) errors.push(`Zeile ${row.line}: Interne Begriffe wie SUB oder OTC gehören nicht ins Motiv.`);
    const next = euro(row.once);
    const previous = euro(row.oldPrice);
    if (next !== undefined && previous !== undefined && next > previous) {
      errors.push(`Zeile ${row.line}: Der neue Einmalpreis liegt über dem alten. Nicht als statt verwenden.`);
    }
    if (row.template.startsWith("kachel_geraet")) {
      if (!row.price) errors.push(`Zeile ${row.line}: Der Monatspreis fehlt.`);
      if (!row.data) errors.push(`Zeile ${row.line}: Das Datenvolumen fehlt.`);
      if (!row.once) errors.push(`Zeile ${row.line}: Der Einmalpreis fehlt.`);
      if (!row.audience) errors.push(`Zeile ${row.line}: Die Zielgruppe fehlt.`);
    }
    if (!row.campaign) errors.push(`Zeile ${row.line}: Die Kampagne fehlt.`);
    if (!row.headline) errors.push(`Zeile ${row.line}: Die Headline fehlt.`);
  }
  return { rows: parsed.rows, errors };
}

const REQUIRED = ["kampagne", "motiv", "vorlage", "headline"] as const;

function splitLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') { current += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      cells.push(current.trim());
      current = "";
    } else current += char;
  }
  cells.push(current.trim());
  return cells;
}

export function parseBatchCsv(source: string): { rows: BatchRow[]; errors: string[] } {
  const text = source.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!text) return { rows: [], errors: ["Die CSV ist leer."] };
  const lines = text.split("\n").filter((line) => line.trim());
  const headerLine = lines[0] ?? "";
  const semicolons = (headerLine.match(/;/g) ?? []).length;
  const commas = (headerLine.match(/,/g) ?? []).length;
  const delimiter = semicolons >= commas ? ";" : ",";
  const header = splitLine(headerLine, delimiter).map((cell) => cell.toLowerCase());
  const errors: string[] = [];
  for (const column of REQUIRED) {
    if (!header.includes(column)) errors.push(`Die Spalte ${column} fehlt.`);
  }
  if (errors.length) return { rows: [], errors };
  const index = (name: string) => header.indexOf(name);
  const rows: BatchRow[] = [];
  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const cells = splitLine(lines[lineIndex] ?? "", delimiter);
    const cell = (name: string) => (index(name) >= 0 ? cells[index(name)] ?? "" : "");
    const languages = cell("sprachen").split(/[,|]/).map((item) => item.trim().toLowerCase()).filter(Boolean);
    const formats = cell("formate").toLowerCase() === "alle" || !cell("formate")
      ? ["pmax-1200x1200", "pmax-1200x628", "pmax-960x1200", "meta-1x1", "meta-9x16", "tiktok-9x16"]
      : cell("formate").split(/[,|]/).map((item) => item.trim()).filter(Boolean);
    rows.push({
      line: lineIndex + 1,
      channel: cell("kanal"),
      audience: cell("zielgruppe"),
      campaign: cell("kampagne"),
      motif: cell("motiv"),
      template: cell("vorlage"),
      headline: cell("headline"),
      subline: cell("subline"),
      badge: cell("stoerer"),
      languages: languages.length ? languages : ["de"],
      formats,
      nameExtra: cell("name_zusatz") || cell("zusatz"),
      logo: cell("logo"),
      button: cell("button"),
      badgeTemplate: cell("stoerer_vorlage") || cell("stoerer-vorlage"),
      deviceName: cell("geraet_name"),
      energy: cell("energielabel"),
      once: cell("einmalpreis"),
      onceExtra: cell("einmalpreis_zusatz"),
      price: cell("preis"),
      priceExtra: cell("preis_zusatz"),
      oldPrice: cell("preis_alt"),
      data: cell("datenmenge"),
      dataOld: cell("datenmenge_alt"),
      star: cell("stern_text"),
      deco: cell("deko"),
    });
  }
  return { rows, errors };
}
