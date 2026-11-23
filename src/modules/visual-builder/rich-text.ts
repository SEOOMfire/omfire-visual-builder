export type Run = { text: string; b: boolean; i: boolean; u: boolean; s: number; f?: string; c?: string };

type Style = { b: boolean; i: boolean; u: boolean; s: number; f?: string; c?: string };

const BLOCK_TAGS = new Set(["DIV", "P", "LI", "H1", "H2", "H3", "H4", "H5", "H6"]);

/** HTML from the text editor → formatting runs for the canvas. Browser only. */
export function htmlToRuns(html: string): Run[] {
  if (typeof document === "undefined") return [];
  const host = document.createElement("div");
  host.innerHTML = html || "";
  const runs: Run[] = [];
  const push = (text: string, style: Style) => {
    if (text) runs.push({ text, ...style });
  };

  const walk = (node: Node, style: Style, firstBlock: { v: boolean }) => {
    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        push((child.textContent || "").replace(/\u00a0/g, " "), style);
        return;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) return;
      const element = child as HTMLElement;
      if (element.tagName === "BR") {
        push("\n", style);
        return;
      }
      const next = { ...style };
      if (element.tagName === "B" || element.tagName === "STRONG") next.b = true;
      if (element.tagName === "I" || element.tagName === "EM") next.i = true;
      if (element.tagName === "U") next.u = true;
      const weight = element.style.fontWeight;
      if (weight && (weight === "bold" || Number(weight) >= 600)) next.b = true;
      if (element.style.fontStyle === "italic") next.i = true;
      if ((element.style.textDecoration || element.style.textDecorationLine || "").includes("underline")) next.u = true;
      const size = element.style.fontSize;
      if (size && size.endsWith("%")) {
        const factor = parseFloat(size) / 100;
        if (factor > 0) next.s = style.s * factor;
      }
      const family = element.style.fontFamily;
      if (family) next.f = family.split(",")[0].trim().replace(/^["']|["']$/g, "");
      if (element.style.color) next.c = element.style.color;

      if (BLOCK_TAGS.has(element.tagName)) {
        if (!firstBlock.v) push("\n", style);
        firstBlock.v = false;
      }
      walk(element, next, firstBlock);
    });
  };

  walk(host, { b: false, i: false, u: false, s: 1 }, { v: true });
  return runs;
}

export function htmlToPlain(html: string): string {
  return htmlToRuns(html).map((run) => run.text).join("").trim();
}

export function plainToHtml(text: string): string {
  const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return text.split("\n").map(escape).join("<br>");
}
