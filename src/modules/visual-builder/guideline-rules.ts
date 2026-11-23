/** Pure helpers for the guideline check, shared by the editor, the server and tests. */

export type CopyPart = { role: "headline" | "subline" | "badge" | "button"; format: string; text: string };

const ROLE_LABEL: Record<CopyPart["role"], string> = { headline: "Headline", subline: "Subline", badge: "Störer", button: "Button" };
const HEADER = /^(Headline|Subline|Störer|Button) \[[^\]\n]*\]:$/;

/**
 * The checked copy names role and formats of every text, so role rules (headline, button) can apply.
 * Identical texts in several formats appear once. The result is also the text the approval is bound to.
 */
export function structuredCopy(parts: readonly CopyPart[]): string {
  const groups: { role: CopyPart["role"]; text: string; formats: string[] }[] = [];
  for (const part of parts) {
    const text = part.text.trim();
    if (!text) continue;
    const group = groups.find((entry) => entry.role === part.role && entry.text === text);
    if (group) group.formats.push(part.format);
    else groups.push({ role: part.role, text, formats: [part.format] });
  }
  const order = { headline: 0, subline: 1, badge: 2, button: 3 } as const;
  return groups
    .sort((a, b) => order[a.role] - order[b.role])
    .map((group) => `${ROLE_LABEL[group.role]} [${group.formats.join(", ")}]:\n${group.text}`)
    .join("\n\n");
}

/** Only the advertising text, without the role headers. */
export function copyOnly(copy: string): string {
  return copy.split("\n").filter((line) => !HEADER.test(line.trim())).join("\n");
}

const LIST_HEADING = /^(?:no[\s-]?words?|no[\s-]?go[\s-]?(?:wörter|words|begriffe)|verbotene\s+(?:wörter|begriffe|formulierungen)|tabu[\s-]?(?:wörter|begriffe)|forbidden\s+words)\s*:?\s*(.*)$/i;

/**
 * Terms from a "No Words" / "Verbotene Wörter" list in the guidelines: the heading followed by a comma separated
 * list, on the same line or the lines below up to the next empty line.
 */
export function forbiddenTerms(guidelines: string): string[] {
  const lines = guidelines.replace(/\r/g, "").split("\n");
  const terms: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const match = LIST_HEADING.exec(lines[index].trim());
    if (!match) continue;
    const collected = [match[1]];
    let next = index + 1;
    if (!match[1].trim()) while (next < lines.length && next <= index + 3 && !lines[next].trim()) next += 1;
    for (; next < lines.length && lines[next].trim(); next += 1) {
      if (!/[,;·]/.test(lines[next])) break;
      collected.push(lines[next]);
    }
    for (const term of collected.join(",").split(/[,;·]/)) {
      const clean = term.replace(/[„“"”]/g, "").trim();
      if (clean.length >= 2 && clean.length <= 40) terms.push(clean);
    }
  }
  return [...new Set(terms)];
}

export function guidelineSystemPrompt(outLang: string): string {
  return "You review advertising copy against brand CI guidelines. The guidelines may be written in a different language than the copy — apply their intent to the copy's language (e.g. forbidden discount wording, tone of voice, typography and market-specific rules such as EN/US formatting). "
    + "The copy is grouped by role (Headline, Subline, Störer = badge or price sticker with one text line per row, Button) with the formats in brackets; apply role-specific rules such as headline length, line count, punctuation, badge or button wording only to that role. Text in [struck: …] is shown crossed out next to the offer (e.g. an old price or the previous data volume); judge it as such and do not read it as part of the running text. "
    + "Report only breaches of rules that are written in the guidelines, never personal taste. Quote the offending words in each message. "
    + "Before reporting, check the quoted words against the rule once more; if the copy already follows the rule (for example the required space, spelling or case is present), do not report it. Texts that the guidelines list as correct examples are never violations. "
    + `Write every 'rule' and 'message' in ${outLang}. Return strict JSON: {"ok": bool, "violations": [{"rule": string, "message": string}]}. If no violations, ok=true with empty violations. Be concise.`;
}

export function guidelineUserPrompt(guidelines: string, copy: string): string {
  return `Guidelines:\n---\n${guidelines}\n---\n\nCopy to review:\n${copy}`;
}

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const normalizeQuotes = (value: string) => value.replace(/[’‘`´]/g, "'");

/** Forbidden terms that appear as whole words in the copy; spaces and hyphens inside a term are interchangeable. */
export function findForbidden(copy: string, terms: readonly string[]): string[] {
  const text = normalizeQuotes(copyOnly(copy));
  return terms.filter((term) => {
    const pattern = normalizeQuotes(term).split(/[\s-]+/).map(escape).join("[\\s-]+");
    return new RegExp(`(?<![\\p{L}\\p{N}])${pattern}(?![\\p{L}\\p{N}])`, "iu").test(text);
  });
}
