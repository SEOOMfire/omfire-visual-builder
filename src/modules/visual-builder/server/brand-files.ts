export type BrandIssue = { path: string; message: string };

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function fontRole(value: unknown, path: string, issues: BrandIssue[]) {
  if (!isObject(value) || typeof value.datei !== "string" || !value.datei.trim()) issues.push({ path, message: "Schrift braucht einen Dateinamen aus schriften/." });
  else if (value.datei.includes("/") || value.datei.includes("..")) issues.push({ path, message: "Der Schrift-Dateiname darf keinen Ordner enthalten." });
  if (!isObject(value) || typeof value.gewicht !== "number" || value.gewicht < 100 || value.gewicht > 900) issues.push({ path: `${path}.gewicht`, message: "Das Schriftgewicht muss zwischen 100 und 900 liegen." });
  if (!isObject(value) || (value.stil !== "normal" && value.stil !== "italic")) issues.push({ path: `${path}.stil`, message: "Der Schriftstil ist normal oder italic." });
}

/** Checks marke.json against the published shape. Unknown keys are kept out so a typo is visible. */
export function validateMarke(value: unknown): BrandIssue[] {
  const issues: BrandIssue[] = [];
  if (!isObject(value)) return [{ path: "", message: "marke.json ist kein Objekt." }];
  const fonts = value.schriften;
  if (!isObject(fonts)) issues.push({ path: "schriften", message: "schriften fehlt." });
  else {
    fontRole(fonts.headline, "schriften.headline", issues);
    fontRole(fonts.body, "schriften.body", issues);
    if (fonts.button) fontRole(fonts.button, "schriften.button", issues);
    if (fonts.stoerer) fontRole(fonts.stoerer, "schriften.stoerer", issues);
  }
  if (!Array.isArray(value.palette)) issues.push({ path: "palette", message: "palette fehlt." });
  else for (const [index, color] of value.palette.entries()) {
    if (!isObject(color) || typeof color.name !== "string" || !/^#[0-9A-Fa-f]{6}$/.test(String(color.hex ?? ""))) {
      issues.push({ path: `palette.${index}`, message: "Jede Farbe braucht einen Namen und einen Hex-Wert wie #112233." });
    }
  }
  if (!Array.isArray(value.sprachen) || value.sprachen.length === 0) issues.push({ path: "sprachen", message: "Mindestens eine Sprache ist nötig." });
  const zones = value.sichereZonen;
  if (!isObject(zones)) issues.push({ path: "sichereZonen", message: "sichereZonen fehlt." });
  else for (const key of ["1080x1080", "1200x628", "1080x1920"]) {
    const zone = zones[key];
    if (!isObject(zone)) issues.push({ path: `sichereZonen.${key}`, message: "Die sichere Zone fehlt." });
  }
  if (!isObject(value.benennung)) issues.push({ path: "benennung", message: "benennung fehlt. Ein leeres Objekt übernimmt den Standard." });
  return issues;
}

export function validateVorlage(value: unknown): BrandIssue[] {
  const issues: BrandIssue[] = [];
  if (!isObject(value)) return [{ path: "", message: "Die Vorlage ist kein Objekt." }];
  if (typeof value.name !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.name)) issues.push({ path: "name", message: "Der Vorlagenname ist klein und mit Bindestrichen, zum Beispiel hero-rechts." });
  if (typeof value.beschreibung !== "string" || value.beschreibung.trim().length < 8) issues.push({ path: "beschreibung", message: "Die Beschreibung sagt, wofür die Vorlage gedacht ist." });
  if (!isObject(value.formate) || Object.keys(value.formate).length === 0) issues.push({ path: "formate", message: "Mindestens ein Format fehlt." });
  else for (const [key, layout] of Object.entries(value.formate)) {
    if (!["1080x1080", "1200x628", "1080x1920"].includes(key)) issues.push({ path: `formate.${key}`, message: "Unbekanntes Format." });
    if (!isObject(layout) || !Array.isArray(layout.textkaesten) || layout.textkaesten.length !== 2) issues.push({ path: `formate.${key}.textkaesten`, message: "Jede Vorlage hat genau zwei Textkästen." });
  }
  return issues;
}
