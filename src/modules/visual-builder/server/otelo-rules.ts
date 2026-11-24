export type CopyFinding = { rule: string; message: string };

const FORBIDDEN = ["krass", "supergeil"];

/** Deterministic otelo checks. The stored ci-richtlinie.md is the same basis in prose. */
export function checkOteloCopy(text: string): CopyFinding[] {
  const findings: CopyFinding[] = [];
  const lines = text.split(/\n/).map((line) => line.trim()).filter(Boolean);
  const headline = lines[0] ?? "";
  if (headline.length > 42 || headline.split(/\s+/).length > 8) {
    findings.push({ rule: "headline-kurz", message: "Die Headline ist zu lang. Höchstens zwei kurze Zeilen." });
  }
  if (/\botelo\b/.test(text) && /(?:^|[.!?]\s+)otelo\b/.test(text) === false && /^otelo\b/i.test(text)) {
    findings.push({ rule: "markenname", message: "otelo steht am Satzanfang. Schreib die Marke klein und möglichst nicht vorn." });
  }
  if (/^otelo\b/i.test(headline) && headline[0] === "O") {
    findings.push({ rule: "markenname", message: "Der Markenname otelo wird klein geschrieben." });
  }
  const lower = text.toLowerCase();
  for (const word of FORBIDDEN) {
    if (lower.includes(word)) findings.push({ rule: "ton", message: `„${word}“ gehört nicht zur Sprache von otelo.` });
  }
  return findings;
}
