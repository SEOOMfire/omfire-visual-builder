import { openRouterComplete, openRouterConfig } from "../../../platform/ai/openrouter";
import { blockingHints } from "./creative-archive";

const MODEL_VARIABLE = "VISUAL_BUILDER_OPENROUTER_MODEL";

export function pruefungText(measured: readonly string[], glance: string): string {
  const blocking = blockingHints(measured);
  const advice = glance.trim() && !/^bestanden\b/i.test(glance.trim()) ? glance.trim() : "";
  const status = blocking.length ? "nicht bestanden" : advice ? "Hinweise" : "bestanden";
  return [`Prüfung: ${status}`, ...blocking, advice].filter(Boolean).join("\n");
}

export function fullReport(measured: readonly string[], glance: string): string {
  const lines = [pruefungText(measured, glance)];
  if (measured.length) lines.push("Gemessen:", ...measured);
  if (glance.trim()) lines.push("Begutachtet:", glance.trim());
  return lines.join("\n");
}

/** A look at the rendered sheet. Never a reason to block saving. */
export async function glanceAt(jpegBase64: string, rules: string): Promise<string> {
  const config = openRouterConfig(MODEL_VARIABLE, "anthropic/claude-sonnet-5.5");
  if (!config.configured || !jpegBase64) return "";
  try {
    const text = await openRouterComplete({
      messages: [
        { role: "system", content: "Du vergleichst ein Werbemotiv mit der CI. Höchstens fünf kurze deutsche Sätze. Wenn es passt, beginne mit Bestanden. Kein Modellname." },
        {
          role: "user",
          content: [
            { type: "text", text: `Richtlinie:\n${rules.slice(0, 3500)}` },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${jpegBase64}` } },
          ],
        },
      ],
      config,
      appTitle: "OMfire Visual-Builder",
      temperature: 0.2,
      maxTokens: 280,
      timeoutMs: 25_000,
    });
    return text.split(/(?<=\.)\s+/).slice(0, 5).join(" ");
  } catch {
    return "";
  }
}
