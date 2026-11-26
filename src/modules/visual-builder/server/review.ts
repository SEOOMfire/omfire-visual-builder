import { openRouterComplete, openRouterConfig } from "../../../platform/ai/openrouter";
import { blockingHints } from "./creative-archive";
import { readClientFile } from "./client-volume";
import { reviewJpeg } from "./review-image";

const MODEL_VARIABLE = "VISUAL_BUILDER_OPENROUTER_MODEL";

function imageLine(glance: string): string {
  const note = glance.trim();
  if (!note) return "Bildprüfung: nicht gelaufen, weil keine Rückmeldung kam.";
  if (/^nicht gelaufen/i.test(note)) return `Bildprüfung: ${note}`;
  if (/^bestanden\b/i.test(note) || note === "keine Anmerkungen") return "Bildprüfung: keine Anmerkungen";
  return `Bildprüfung: ${note}`;
}

/** The image check must not be the only one that sees covered type. */
export function glanceContradictsMeasure(measured: readonly string[], glance: string): boolean {
  const imageOverlap = /verdeckt|überlappt|überdeckt/i.test(glance) && /text|headline|unterzeile|schrift|buchstabe|kachel|pille|cta/i.test(glance);
  if (!imageOverlap) return false;
  return !measured.some((hint) => /nicht bestanden/i.test(hint) && /stern/i.test(hint) && /überdeckt|überlappt|verdeckt/i.test(hint));
}

/** Formats whose image review starts with „Nicht bestanden“. */
export function failedGlanceFormats(glance: string): string[] {
  return glance.split(/\n/).flatMap((line) => {
    const match = line.match(/^([^:\n]+):\s*nicht bestanden\b/i);
    return match?.[1] ? [match[1].trim()] : [];
  });
}

export function pruefungText(measured: readonly string[], glance: string): string {
  const blocking = blockingHints(measured);
  const image = imageLine(glance);
  const failed = failedGlanceFormats(glance);
  const noted = !image.endsWith("keine Anmerkungen") && !/nicht gelaufen/i.test(image);
  const status = blocking.length ? "nicht bestanden" : failed.length ? `Bildprüfung nicht bestanden (${failed.join(", ")})` : noted ? "Hinweise" : "bestanden";
  return [`Prüfung: ${status}`, ...blocking, image].join("\n");
}

/** Headline width that is normal for this format. 9x16 is 78 percent, not 83. */
export function headlineTarget(formatLabel: string): string {
  if (/9x16|1920/.test(formatLabel)) return "78";
  if (/628/.test(formatLabel)) return "55";
  return "83";
}

/** A concrete violation from the fixed list. Percentages, arrows and tile position are not on it. */
export function glanceViolation(note: string, formatLabel = ""): string | undefined {
  const text = note.replace(/\s+/g, " ").trim();
  const story = /9x16|1920/.test(formatLabel);
  const covered = /überdeckt|überlappt|verdeckt|abgeschnitten|angeschnitten/i.test(text);
  const aboutText = /text|headline|unterzeile|schrift|preis|cta|logo|buchstabe|zeile|stern/i.test(text);
  if (covered && aboutText && !/referenz/i.test(text)) return text;
  if (/gesicht/i.test(text) && /verdeckt|überdeckt|abgeschnitten|nicht (?:sichtbar|frei)/i.test(text)) return text;
  if (/unleserlich|nicht lesbar/i.test(text)) return text;
  if (/(stern|text|schrift)[^.]{0,24}zu klein|zu klein[^.]{0,24}(stern|text|schrift)/i.test(text)) return text;
  if (/(stern|text|schrift)[^.]{0,16}ist klein/i.test(text)) return text;
  if (/(falsche|unzulässige)[^.]{0,20}farbe|farbe[^.]{0,30}(nicht|außerhalb)[^.]{0,24}(lime|orange|schwarz|weiß|weiss|ci)/i.test(text)) return text;
  if (/(logo|cta|preis)[^.]{0,24}fehlt/i.test(text)) {
    if (story && /logo/i.test(text) && !/cta|preis/i.test(text)) return undefined;
    return text;
  }
  return undefined;
}

/** Every format line starts with one of the two verdicts. A bare „Bestanden.“ is enough. */
export function glanceLine(note: string, formatLabel = ""): string {
  const text = note.replace(/\s+/g, " ").trim();
  if (!text || /^nicht gelaufen\b/i.test(text)) return text;
  if (/^keine anmerkungen\b/i.test(text)) return "Bestanden.";
  const body = text.replace(/^(?:nicht bestanden|bestanden)\b[.:]?\s*/i, "").trim();
  const violation = glanceViolation(body.replace(/das passt|ist zulässig|kein fehler/gi, ""), formatLabel);
  if (!violation) return body ? `Bestanden. ${body}` : "Bestanden.";
  return `Nicht bestanden: ${body}`;
}

const GLANCE_ARTS = new Set(["text_ueberdeckt", "text_abgeschnitten", "gesicht_verdeckt", "text_unleserlich", "falsche_ci_farbe", "pflichtelement_fehlt"]);

export type GlanceViolation = { art: string; element: string; beschreibung: string };

/** Drops reports that the prompt lists as not a violation. */
export function keepGlanceViolation(item: GlanceViolation, formatLabel = "", briefing = ""): boolean {
  if (!GLANCE_ARTS.has(item.art)) return false;
  const blob = `${item.element} ${item.beschreibung}`;
  if (/dieser punkt zählt als angewiesene änderung/i.test(blob)) return false;
  if (/statt/i.test(blob) && /durchstreich|streichung|gestrichen/i.test(blob)) return false;
  if (/display|branding/i.test(blob)) return false;
  if (/9x16|1920/.test(formatLabel) && item.art === "pflichtelement_fehlt" && /logo/i.test(blob)) return false;
  if (/prozent|%/i.test(blob)) return false;
  if (/position/i.test(blob) && /cta|kachel|pfeil/i.test(blob)) return false;
  if (/referenz/i.test(blob)) return false;
  if (/schriftart|schriftschnitt|titillium|geist/i.test(blob)) return false;
  if (/haar|kleidung|körper|koerper|pulli|schulter/i.test(blob) && !/augen|nase|mund/i.test(blob)) return false;
  const claimed = [
    ...blob.matchAll(/[„"]([^“"]+)[“"]/g),
  ].map((match) => match[1]?.trim() ?? "").concat(blob.match(/\blautet\s+([^.,]+)/i)?.[1]?.trim() ?? "").filter(Boolean);
  if (claimed.some((phrase) => !briefing.toLowerCase().includes(phrase.toLowerCase()))) return false;
  return true;
}

/** Status comes from the JSON list. Prose without that list is „Bestanden.“ */
export function parseGlance(raw: string, formatLabel = "", briefing = ""): string {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return "Bestanden.";
  let payload: { verstoesse?: unknown };
  try {
    payload = JSON.parse(match[0]) as { verstoesse?: unknown };
  } catch {
    return "Bestanden.";
  }
  const list = Array.isArray(payload.verstoesse) ? payload.verstoesse : [];
  const kept = list.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const record = entry as { art?: unknown; element?: unknown; beschreibung?: unknown };
    const item = {
      art: String(record.art ?? ""),
      element: String(record.element ?? ""),
      beschreibung: String(record.beschreibung ?? "").replace(/Dieser Punkt zählt als angewiesene Änderung\.?/gi, "").trim(),
    };
    return item.beschreibung && keepGlanceViolation(item, formatLabel, briefing) ? [item] : [];
  });
  if (!kept.length) return "Bestanden.";
  return `Nicht bestanden: ${kept.map((item) => item.beschreibung).join(" ")}`;
}

/** The image check returns a JSON list. The status is computed here. */
export function glanceBrief(instructed = "", measured = "", rules = "", formatLabel = "", briefing = ""): string {
  const share = headlineTarget(formatLabel);
  return `Das Motiv, also die Person oder das Gerät, ist absichtlich ein anderes als in der Referenz.\nDieses Bild ist nur das Format ${formatLabel || "des Entwurfs"} in voller Auflösung, kein Kontaktbogen.\nSoll: Headline-Breite etwa ${share} Prozent. Das ist kein Verstoß.\nGesetzte Texte, nicht per Bild prüfen:\n${briefing || "keine"}\nAntworte nur mit JSON: {"verstoesse":[{"art":"text_ueberdeckt"|"text_abgeschnitten"|"gesicht_verdeckt"|"text_unleserlich"|"falsche_ci_farbe"|"pflichtelement_fehlt","element":"…","beschreibung":"…"}]}\nLeere Liste, wenn keiner dieser sechs Fälle zutrifft.\nTexte wie CTA, Preise und Headline nicht bewerten. Ein Verstoß, der einen anderen Wortlaut behauptet als die gesetzten Felder, ist keiner.\nÜberlappung nur, wenn Text verdeckt ist oder das Gesicht, also Augen, Nase oder Mund. CTA-Spitze, Stern oder Kachel über Haaren, Kleidung oder Körper ist kein Verstoß.\nKein Verstoß: Durchstreichung des statt-Preises, Branding oder Text auf dem Geräte-Display, fehlendes Logo im 9x16, Headline-Prozente, Position von CTA oder Kachel, Abweichung von der Referenz. Schriftart und Schriftschnitt nicht bewerten.\nSchreibe keinen Satz und nimm keinen Verstoß auf, der „Dieser Punkt zählt als angewiesene Änderung“ enthält.\nAngewiesen: ${instructed || "keine"}\nGemessen:\n${measured.slice(0, 1800)}\nRichtlinie:\n${rules.slice(0, 1200)}`;
}

/** Keeps whole sentences. A period inside „bzw.“ does not end a sentence. */
export function completeSentences(text: string, limit = 2): string {
  const masked = text.replace(/\b(bzw|usw|etc|ca|Nr|Dr|z\. B)\./gi, (token) => token.replace(/\./g, "\u0001"));
  const parts = masked.split(/(?<=[.!?])\s+/).map((part) => part.replace(/\u0001/g, ".").trim()).filter(Boolean);
  const complete = parts.filter((part) => /[.!?]$/.test(part));
  const chosen = (complete.length ? complete : parts).slice(0, limit);
  return chosen.join(" ").trim();
}

export function fullReport(measured: readonly string[], glance: string): string {
  const lines = [pruefungText(measured, glance)];
  if (measured.length) lines.push("Gemessen:", ...measured);
  if (glance.trim()) lines.push("Begutachtet:", glance.trim());
  return lines.join("\n");
}

/** Drops review sentences that only repeat a change the user asked for. */
export function withoutInstructed(glance: string, instructed: string): string {
  const notes = instructed.trim();
  const drop: RegExp[] = [];
  if (/unterzeile/i.test(notes) && /lime/i.test(notes)) drop.push(/unterzeile|subline/i);
  if (/störer/i.test(notes) && /ausgeblendet/i.test(notes)) drop.push(/st[öo]rer|stern/i);
  if (/altwert/i.test(notes)) drop.push(/altwert/i);
  if (/blätter/i.test(notes)) drop.push(/bl[äa]tter|welle/i);
  if (/deko/i.test(notes) && /keine/i.test(notes)) drop.push(/welle|bl[äa]tter|deko/i);
  const kept = glance.split(/(?<=\.)\s+/).filter((sentence) => {
    if (/referenztext|referenz-text|statt des|wortlaut|textinhalt/i.test(sentence)) return false;
    if (/(kleidung|display|produktbild|foto)/i.test(sentence) && /farbe|farb|ci/i.test(sentence)) return false;
    if (/energie/i.test(sentence) && /farbe|farb|grün|gruen/i.test(sentence)) return false;
    if (/schriftart|schriftschnitt|titillium|geist/i.test(sentence)) return false;
    if (!notes) return true;
    if (!drop.some((pattern) => pattern.test(sentence))) return true;
    return !/fehlt|fehl|statt|abweich|orange|nicht (?:da|sichtbar|vorhanden)|entfernt|ohne/i.test(sentence);
  });
  const text = kept.join(" ").trim();
  return text || "keine Anmerkungen";
}

/** A look at one format. Never a reason to block saving. */
export async function glanceAt(jpegBase64: string, rules: string, referencePath = "files/referenz/styleguide-seite-4.jpg", measured = "", formatLabel = "", instructed = "", _fontRule = "", briefing = ""): Promise<string> {
  const config = openRouterConfig(MODEL_VARIABLE, "anthropic/claude-sonnet-5.5");
  if (!config.configured) return "nicht gelaufen, weil die Prüfung nicht erreichbar ist.";
  if (!jpegBase64) return "nicht gelaufen, weil kein Bild vorlag.";
  const reference = await readClientFile("otelo", referencePath).catch(() => null);
  const images: Array<{ type: "image_url"; image_url: { url: string } }> = [
    { type: "image_url", image_url: { url: `data:image/jpeg;base64,${reviewJpeg(Buffer.from(jpegBase64, "base64")).toString("base64")}` } },
  ];
  if (reference && images.length < 2) images.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${reviewJpeg(reference).toString("base64")}` } });
  const ask = (reasoning?: { effort: "low" | "none"; exclude?: boolean }) => openRouterComplete({
      messages: [
        { role: "system", content: "Du prüfst ein Werbemotiv und antwortest nur mit JSON. Kein Modellname. Keine anderen Sätze." },
        {
          role: "user",
          content: [
            { type: "text", text: glanceBrief(instructed, measured, rules, formatLabel, briefing) },
            ...images,
          ],
        },
      ],
      config,
      appTitle: "OMfire Visual-Builder",
      temperature: 0.2,
      maxTokens: 1500,
      timeoutMs: 30_000,
      reasoning,
    });
  try {
    let text: string;
    try {
      text = await ask({ effort: "low", exclude: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (!/keine Antwort|abgelehnt/.test(message)) throw error;
      text = await ask(undefined);
    }
    return parseGlance(text, formatLabel, briefing);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unbekannter Fehler";
    return `nicht gelaufen, weil ${message.replace(/\s+/g, " ").slice(0, 180)}`;
  }
}

export async function glanceFormats(
  formats: Array<{ label: string; jpeg: string }>,
  rules: string,
  referencePath: string,
  measured = "",
  instructed = "",
  fontRule = "",
  briefing = "",
): Promise<string> {
  const picked = formats.filter((format) => format.jpeg);
  const notes = await Promise.all(picked.map(async (format) => {
    const note = await glanceAt(format.jpeg, rules, referencePath, measured, format.label, instructed, fontRule, briefing);
    return `${format.label}: ${note}`;
  }));
  return notes.join("\n");
}
