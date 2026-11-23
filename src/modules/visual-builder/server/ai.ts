import "server-only";

import type { PlatformPrincipal } from "../../../platform/auth/capabilities";
import { openRouterComplete, openRouterConfig, type OpenRouterMessage } from "../../../platform/ai/openrouter";
import { openRouterModelChain } from "../../../platform/ai/openrouter-policy";
import { logBackgroundError } from "../../../platform/observability/background-error";
import { tenantQuery } from "../../../platform/database/client";
import { consumeDistributedRateLimit } from "../../../platform/security/distributed-rate-limit";
import type { Locale, Violation } from "../types";
import { findForbidden, forbiddenTerms, guidelineSystemPrompt, guidelineUserPrompt } from "../guideline-rules";
import { parseGuidelineResult, sanitizeHtml, stripCodeFence } from "./parse";
import { databaseContext, requireVisualBuilderCapability, VISUAL_BUILDER_SLUG, VisualBuilderInputError } from "./access";

const MODEL_VARIABLE = "VISUAL_BUILDER_OPENROUTER_MODEL";
const DEFAULT_MODEL = "anthropic/claude-sonnet-5.5";
/** Models that follow written CI rules closely and reliably answer in JSON. */
const DEFAULT_FALLBACKS = ["openai/gpt-6.1-sol", "google/gemini-4-argon"];
const MAX_ITEMS = 24;
const MAX_ITEM_CHARS = 20_000;
const MAX_TOTAL_CHARS = 60_000;

function config() {
  const configured = openRouterConfig(MODEL_VARIABLE, DEFAULT_MODEL);
  const value = process.env.VISUAL_BUILDER_OPENROUTER_FALLBACK_MODELS?.trim()
    ? configured
    : { ...configured, models: openRouterModelChain(configured.model, DEFAULT_FALLBACKS) };
  if (!value.configured) throw new VisualBuilderInputError("Übersetzung und Prüfung sind gerade nicht verfügbar.", 503);
  return value;
}

async function rateLimit(principal: PlatformPrincipal) {
  const result = await consumeDistributedRateLimit({
    scope: "visual-builder.assist",
    identityParts: [principal.tenantId, principal.userId],
    maxRequests: 120,
    windowSeconds: 3600,
  });
  if (!result.success) throw new VisualBuilderInputError("Zu viele Anfragen in kurzer Zeit. Bitte gleich noch einmal versuchen.", 429);
}

function translationMessages(input: { text: string; targetLang: string; targetLabel: string; isHtml: boolean }): OpenRouterMessage[] {
  const htmlRules = input.isHtml
    ? " The input is an HTML fragment. Preserve ALL markup exactly: keep every tag (b, strong, i, em, u, span, br, div, p), their order, nesting and all attributes (especially style with font-size, font-family, font-weight). Translate ONLY the visible text nodes, keeping each translated word inside the same tag that wrapped the corresponding source words. Never add, remove, merge or reorder tags. Output ONLY the HTML fragment, no code fences, no commentary."
    : "";
  return [
    {
      role: "system",
      content: "You are a professional advertising copy translator. Preserve tone, brand voice, punctuation and length as much as possible. Output ONLY the translated text, no quotes, no commentary." + htmlRules,
    },
    { role: "user", content: `Translate the following advertising copy to ${input.targetLabel} (${input.targetLang}):\n\n${input.text}` },
  ];
}

export type TranslationItem = { key: string; text: string; isHtml: boolean };

export async function translateItems(
  principal: PlatformPrincipal,
  input: { items?: unknown; targetLang?: unknown; targetLabel?: unknown },
): Promise<Record<string, string>> {
  requireVisualBuilderCapability(principal, "create");
  const targetLang = String(input.targetLang ?? "").trim();
  if (!/^[A-Za-z]{2,3}([-_][A-Za-z0-9]{2,8}){0,2}$/.test(targetLang)) throw new VisualBuilderInputError("Bitte eine Zielsprache wählen.");
  const targetLabel = String(input.targetLabel ?? "").trim().slice(0, 80) || targetLang;
  if (!Array.isArray(input.items) || input.items.length === 0 || input.items.length > MAX_ITEMS) throw new VisualBuilderInputError("Es gibt nichts zu übersetzen.");
  const items: TranslationItem[] = input.items.map((raw) => {
    const item = raw as Record<string, unknown>;
    const text = typeof item.text === "string" ? item.text : "";
    if (!text.trim() || text.length > MAX_ITEM_CHARS) throw new VisualBuilderInputError("Ein Text ist leer oder zu lang.");
    return { key: String(item.key ?? "").slice(0, 40), text, isHtml: item.isHtml === true };
  });
  if (items.reduce((sum, item) => sum + item.text.length, 0) > MAX_TOTAL_CHARS) throw new VisualBuilderInputError("Die Texte sind zu lang.");
  await rateLimit(principal);
  const model = config();

  const result: Record<string, string> = {};
  const queue = [...items];
  const worker = async () => {
    for (let item = queue.shift(); item; item = queue.shift()) {
      let output: string;
      try {
        output = await openRouterComplete({
          messages: translationMessages({ text: item.text, targetLang, targetLabel, isHtml: item.isHtml }),
          config: model,
          appTitle: "OMfire Visual-Builder",
          temperature: 0.2,
          maxTokens: 4000,
          timeoutMs: 45_000,
          tracking: {
            tenantId: principal.tenantId,
            userId: principal.userId,
            moduleSlug: VISUAL_BUILDER_SLUG,
            purpose: "translate",
            reason: "Werbetext in eine Zielsprache übertragen",
          },
        });
      } catch {
        throw new VisualBuilderInputError("Die Übersetzung ist fehlgeschlagen. Bitte erneut versuchen.", 502);
      }
      let translated = output.trim();
      if (item.isHtml) translated = sanitizeHtml(stripCodeFence(translated));
      result[item.key] = translated;
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, items.length) }, worker));
  return result;
}

export async function checkGuidelines(
  principal: PlatformPrincipal,
  input: { text?: unknown; locale?: unknown },
): Promise<{ ok: boolean; violations: Violation[]; checkId: string }> {
  requireVisualBuilderCapability(principal, "create");
  const locale: Locale = input.locale === "en" ? "en" : "de";
  const en = locale === "en";
  const text = typeof input.text === "string" ? input.text : "";
  if (text.length > 5000) throw new VisualBuilderInputError(en ? "The text is too long (max. 5,000 characters)." : "Der Text ist zu lang (max. 5.000 Zeichen).");
  /** Every check is recorded, so a creative with findings can still be saved and downloaded as not signed off. */
  const record = async (violations: Violation[]) => {
    const approved = violations.length === 0;
    const rows = await tenantQuery<{ id: string }>(databaseContext(principal),
      `insert into public.visual_builder_guideline_checks (tenant_id, user_id, source_text, approved, violations)
       values ($1,$2,$3,$4,$5::jsonb) returning id`,
      [principal.tenantId, principal.userId, text, approved, JSON.stringify(violations)]);
    return { ok: approved, violations, checkId: rows[0]!.id };
  };
  if (!text.trim()) return record([]);
  const guideline = await tenantQuery<{ content_text: string }>(databaseContext(principal),
    `select content_text from public.visual_builder_guidelines where tenant_id = $1`, [principal.tenantId]);
  const rules = guideline[0]?.content_text?.trim();
  const notPossible = (message: string): Violation[] => [{ rule: en ? "Check not possible" : "Prüfung nicht möglich", message }];
  if (!rules) {
    return record(notPossible(en ? "No CI guidelines saved yet (Settings → CI guidelines)." : "Noch keine CI-Richtlinien hinterlegt (Einstellungen → CI-Richtlinien)."));
  }
  await rateLimit(principal);
  const outLang = en ? "English (US)" : "German";
  const listed: Violation[] = findForbidden(text, forbiddenTerms(rules)).map((term) => ({
    rule: en ? "Forbidden words" : "Verbotene Wörter",
    message: en ? `“${term}” is on the list of forbidden words.` : `„${term}“ steht auf der Liste der verbotenen Wörter.`,
  }));
  let raw: string;
  try {
    raw = await openRouterComplete({
      messages: [
        {
          role: "system",
          content: guidelineSystemPrompt(outLang),
        },
        { role: "user", content: guidelineUserPrompt(rules, text) },
      ],
      config: config(),
      appTitle: "OMfire Visual-Builder",
      temperature: 0,
      maxTokens: 2000,
      timeoutMs: 60_000,
      responseFormat: { type: "json_object" },
      tracking: {
        tenantId: principal.tenantId,
        userId: principal.userId,
        moduleSlug: VISUAL_BUILDER_SLUG,
        purpose: "guideline-check",
        reason: "Werbetext gegen die CI-Richtlinien prüfen",
      },
    });
  } catch (error) {
    logBackgroundError(error, "visual-builder.guideline-check");
    return record([...listed, ...notPossible(en ? "The check did not respond. Please check again later." : "Die Prüfung hat nicht geantwortet. Bitte später erneut prüfen.")]);
  }
  const parsed = parseGuidelineResult(raw);
  if (!parsed) return record([...listed, ...notPossible(en ? "The check returned no usable result. Please check again." : "Die Prüfung lieferte kein verwertbares Ergebnis. Bitte erneut prüfen.")]);
  const violations = [...listed, ...parsed.violations];
  if (!parsed.ok && violations.length === 0) violations.push({ rule: en ? "Guidelines" : "Richtlinien", message: en ? "The check found a breach without details. Please check again." : "Die Prüfung meldet einen Verstoß ohne Details. Bitte erneut prüfen." });
  return record(violations);
}
