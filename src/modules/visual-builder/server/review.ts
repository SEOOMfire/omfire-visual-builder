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
  if (!notes) return glance;
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
    if (/titillium/i.test(notes) && /geist/i.test(sentence)) return false;
    if (!drop.some((pattern) => pattern.test(sentence))) return true;
    return !/fehlt|fehl|statt|abweich|orange|nicht (?:da|sichtbar|vorhanden)|entfernt|ohne/i.test(sentence);
  });
  const text = kept.join(" ").trim();
  return text || "keine Anmerkungen";
}

/** A look at one format. Never a reason to block saving. */
export async function glanceAt(jpegBase64: string, rules: string, referencePath = "files/referenz/styleguide-seite-4.jpg", measured = "", formatLabel = "", instructed = "", fontRule = ""): Promise<string> {
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
        { role: "system", content: "Du vergleichst ein Werbemotiv mit der CI und, falls vorhanden, mit dem zweiten Bild als Referenz. Höchstens fünf kurze deutsche Sätze. Wenn es passt, beginne mit Bestanden. Kein Modellname." },
        {
          role: "user",
          content: [
            { type: "text", text: `Das Motiv, also die Person oder das Gerät, ist absichtlich ein anderes als in der Referenz. Bewerte nur Aufbau, Größen und CI.\nIm 9x16 ist kein Logo vorgesehen.\nIm Format 1200x628 ist eine Headline-Breite um 55 Prozent der Normalfall, bei der Personen-Kachel und beim Gerät. Das ist kein Fehler.\nAngewiesene Änderungen sind kein Fehler. Melde sie nicht. Deko „keine“ ist eine bewusste Wahl. Fehlende Wellen oder fehlende Blätter sind dann kein Fehler und werden nicht gemeldet. ${fontRule} Melde nur CI-Verstöße an gesetzten Flächen und Texten (Headline, Unterzeile, Kachel, CTA, Stern, Logo). Farben im Foto oder Produktbild, also Kleidung und Display, sind kein Verstoß. Die Farben des Energielabels sind gesetzlich vorgegeben und nie ein CI-Fehler. Eine unzulässige Textfarbe außerhalb von Lime, Orange, Schwarz und Weiß bleibt ein Verstoß. Textinhalte des Nutzers, auch der Sterntext, nie mit dem Referenztext vergleichen und nie als Abweichung werten.\nAngewiesen: ${instructed || "keine"}\nDieses Bild ist nur das Format ${formatLabel || "des Entwurfs"}.\nGemessen:\n${measured.slice(0, 1800)}\nRichtlinie:\n${rules.slice(0, 1200)}\nDas erste Bild ist der Entwurf, das zweite die Referenz. Höchstens zwei Sätze zu diesem einen Format.` },
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
    return withoutInstructed(completeSentences(text), instructed);
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
): Promise<string> {
  const picked = formats.filter((format) => format.jpeg);
  const notes = await Promise.all(picked.map(async (format) => {
    const note = await glanceAt(format.jpeg, rules, referencePath, measured, format.label, instructed, fontRule);
    return `${format.label}: ${note}`;
  }));
  return notes.join("\n");
}
