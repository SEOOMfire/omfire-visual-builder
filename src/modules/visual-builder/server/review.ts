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

/** A look at the rendered sheet. Never a reason to block saving. */
export async function glanceAt(jpegBase64: string, rules: string, referencePath = "files/referenz/styleguide-seite-4.jpg", measured = ""): Promise<string> {
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
            { type: "text", text: `Das Motiv, also die Person oder das Gerät, ist absichtlich ein anderes als in der Referenz. Bewerte nur Aufbau, Größen und CI.\nIm 9x16 ist kein Logo vorgesehen.\nGemessen:\n${measured.slice(0, 1800)}\nRichtlinie:\n${rules.slice(0, 1800)}\nDas erste Bild ist der Entwurf, das zweite die Referenz. Höchstens fünf Sätze. Jeder Satz nennt einen konkreten Mangel und das Format.` },
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
    return text.split(/(?<=\.)\s+/).slice(0, 5).join(" ");
  } catch (error) {
    const message = error instanceof Error ? error.message : "unbekannter Fehler";
    return `nicht gelaufen, weil ${message.replace(/\s+/g, " ").slice(0, 180)}`;
  }
}
