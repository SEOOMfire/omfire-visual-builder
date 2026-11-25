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

export function pruefungText(measured: readonly string[], glance: string): string {
  const blocking = blockingHints(measured);
  const image = imageLine(glance);
  const noted = !image.endsWith("keine Anmerkungen") && !/nicht gelaufen/i.test(image);
  const status = blocking.length ? "nicht bestanden" : noted ? "Hinweise" : "bestanden";
  return [`Prüfung: ${status}`, ...blocking, image].join("\n");
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
  const kept = glance.split(/(?<=\.)\s+/).filter((sentence) => {
    if (/referenztext|referenz-text|statt des|wortlaut|textinhalt/i.test(sentence)) return false;
    if (/(kleidung|display|produktbild|foto)/i.test(sentence) && /farbe|farb|ci/i.test(sentence)) return false;
    if (/energie/i.test(sentence) && /farbe|farb|grün|gruen/i.test(sentence)) return false;
    if (!drop.some((pattern) => pattern.test(sentence))) return true;
    return !/fehlt|statt|abweich|orange|nicht (?:da|sichtbar)|entfernt/i.test(sentence);
  });
  const text = kept.join(" ").trim();
  return text || "keine Anmerkungen";
}

/** A look at one format. Never a reason to block saving. */
export async function glanceAt(jpegBase64: string, rules: string, referencePath = "files/referenz/styleguide-seite-4.jpg", measured = "", formatLabel = "", instructed = ""): Promise<string> {
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
            { type: "text", text: `Das Motiv, also die Person oder das Gerät, ist absichtlich ein anderes als in der Referenz. Bewerte nur Aufbau, Größen und CI.\nIm 9x16 ist kein Logo vorgesehen.\nAngewiesene Änderungen sind kein Fehler. Melde sie nicht. Melde nur CI-Verstöße an gesetzten Flächen und Texten (Headline, Unterzeile, Kachel, CTA, Stern, Logo). Farben im Foto oder Produktbild, also Kleidung und Display, sind kein Verstoß. Die Farben des Energielabels sind gesetzlich vorgegeben und nie ein CI-Fehler. Eine unzulässige Textfarbe außerhalb von Lime, Orange, Schwarz und Weiß bleibt ein Verstoß. Textinhalte des Nutzers, auch der Sterntext, nie mit dem Referenztext vergleichen und nie als Abweichung werten.\nAngewiesen: ${instructed || "keine"}\nDieses Bild ist nur das Format ${formatLabel || "des Entwurfs"}.\nGemessen:\n${measured.slice(0, 1800)}\nRichtlinie:\n${rules.slice(0, 1200)}\nDas erste Bild ist der Entwurf, das zweite die Referenz. Höchstens zwei Sätze zu diesem einen Format.` },
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
    return withoutInstructed(text.split(/(?<=\.)\s+/).slice(0, 2).join(" "), instructed);
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
): Promise<string> {
  const picked = formats.filter((format) => format.jpeg);
  const notes = await Promise.all(picked.map(async (format) => {
    const note = await glanceAt(format.jpeg, rules, referencePath, measured, format.label, instructed);
    return `${format.label}: ${note}`;
  }));
  return notes.join("\n");
}
