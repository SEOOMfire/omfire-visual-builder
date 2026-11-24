export type BatchRow = {
  line: number;
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
};

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
      ? ["1080x1080", "1200x628", "1080x1920"]
      : cell("formate").split(/[,|]/).map((item) => item.trim()).filter(Boolean);
    rows.push({
      line: lineIndex + 1,
      campaign: cell("kampagne"),
      motif: cell("motiv"),
      template: cell("vorlage"),
      headline: cell("headline"),
      subline: cell("subline"),
      badge: cell("stoerer"),
      languages: languages.length ? languages : ["de"],
      formats,
      nameExtra: cell("name_zusatz"),
      logo: cell("logo"),
      button: cell("button"),
      badgeTemplate: cell("stoerer_vorlage") || cell("stoerer-vorlage"),
    });
  }
  return { rows, errors };
}
