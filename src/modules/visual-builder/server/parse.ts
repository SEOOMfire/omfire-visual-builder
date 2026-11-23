import type { Violation } from "../types";
import { DRIVE_ID_PATTERN, VisualBuilderInputError } from "./access";

/** Pure helpers without I/O, shared by the server code and its tests. */

export function sanitizeHtml(html: string): string {
  return html
    .replace(/<\s*(script|style|iframe|object|embed)[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*(script|style|iframe|object|embed)\b[^>]*\/?>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "");
}

export function stripCodeFence(value: string): string {
  return value.replace(/^```(?:html)?\s*/i, "").replace(/```$/, "").trim();
}

export function parseGuidelineResult(raw: string): { ok: boolean; violations: Violation[] } | null {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try { parsed = JSON.parse(cleaned.slice(start, end + 1)); } catch { return null; }
  }
  if (!parsed || typeof parsed !== "object") return null;
  const value = parsed as { ok?: unknown; violations?: unknown };
  if (typeof value.ok !== "boolean" || !Array.isArray(value.violations)) return null;
  const violations: Violation[] = [];
  for (const entry of value.violations) {
    const item = entry as { rule?: unknown; message?: unknown };
    if (typeof item?.rule !== "string" || typeof item?.message !== "string") return null;
    violations.push({ rule: item.rule.trim().slice(0, 300), message: item.message.trim().slice(0, 1000) });
  }
  return { ok: value.ok, violations };
}

export function parseFolderId(value: unknown): string {
  const raw = String(value ?? "").trim();
  const id = raw.replace(/.*folders\//, "").replace(/[?#].*/, "");
  if (!DRIVE_ID_PATTERN.test(id)) throw new VisualBuilderInputError("Bitte eine gültige Ordner-ID oder einen Ordner-Link angeben.");
  return id;
}
