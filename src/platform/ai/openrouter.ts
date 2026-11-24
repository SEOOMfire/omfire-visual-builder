import { openRouterModelChain } from "./openrouter-policy";

export const OPENROUTER_API_KEY_VARIABLE = "OPENROUTER_API_KEY";

export type OpenRouterContent =
  | string
  | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;

export type OpenRouterMessage = { role: "system" | "user" | "assistant"; content: OpenRouterContent };

export type OpenRouterConfig = {
  apiKey: string | undefined;
  model: string;
  models: string[];
  configured: boolean;
};

export function openRouterConfig(modelVariable: string, fallbackModel: string): OpenRouterConfig {
  const apiKey = process.env[OPENROUTER_API_KEY_VARIABLE]?.trim();
  const model = process.env[modelVariable]?.trim() || fallbackModel;
  const fallbackVariable = modelVariable.replace(/_MODEL$/, "_FALLBACK_MODELS");
  const configuredFallbacks = (process.env[fallbackVariable]?.trim() || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return {
    apiKey,
    model,
    models: openRouterModelChain(model, configuredFallbacks),
    configured: Boolean(apiKey),
  };
}

function textOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map((part) => (part && typeof part === "object" && "text" in part ? String(part.text ?? "") : "")).join("");
}

export async function openRouterComplete(input: {
  messages: OpenRouterMessage[];
  config: OpenRouterConfig;
  appTitle: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  responseFormat?: { type: "json_object" };
  tracking?: { purpose?: string; tenantId?: string; userId?: string; moduleSlug?: string; reason?: string };
}): Promise<string> {
  if (!input.config.apiKey) throw new Error("Der Sprachdienst ist nicht konfiguriert.");
  let lastStatus = 0;
  for (const model of input.config.models) {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.config.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER?.trim() || process.env.APP_ORIGIN?.trim() || "http://localhost:3000",
        "X-Title": process.env.OPENROUTER_APP_TITLE?.trim() || input.appTitle,
      },
      body: JSON.stringify({
        model,
        messages: input.messages,
        temperature: input.temperature,
        max_tokens: input.maxTokens,
        ...(input.responseFormat ? { response_format: input.responseFormat } : {}),
      }),
      signal: AbortSignal.timeout(input.timeoutMs),
    });
    if (!response.ok) {
      lastStatus = response.status;
      const detail = (await response.text().catch(() => "")).replace(/\s+/g, " ");
      console.error(JSON.stringify({ area: input.tracking?.purpose ?? "assist", model, status: response.status, body: detail.slice(0, 4000) }));
      if (response.status === 429 || response.status >= 500) continue;
      throw new Error(`Der Sprachdienst hat die Anfrage abgelehnt (${response.status}${detail ? `: ${detail.slice(0, 500)}` : ""}).`);
    }
    const json = await response.json() as { choices?: Array<{ message?: { content?: unknown } }> };
    const message = json.choices?.[0]?.message;
    const text = textOf(message?.content).trim();
    if (!text) {
      const keys = message && typeof message === "object" ? Object.keys(message) : [];
      console.error(JSON.stringify({ area: "bildpruefung-leer", model, keys, sample: JSON.stringify(message ?? json).slice(0, 2000) }));
      throw new Error(`Der Sprachdienst hat keine Antwort geliefert (${keys.join(", ") || "ohne Felder"}).`);
    }
    return text;
  }
  console.error(JSON.stringify({ area: input.tracking?.purpose ?? "assist", status: lastStatus }));
  throw new Error(`Der Sprachdienst hat die Anfrage abgelehnt (${lastStatus || 502}).`);
}
