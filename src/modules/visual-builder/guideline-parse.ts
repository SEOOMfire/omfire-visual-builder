"use client";

/** Browser-only: extracts plain text from DOCX, PDF, TXT or Markdown files. */
export async function extractGuidelineText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  const buffer = await file.arrayBuffer();
  if (name.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ arrayBuffer: buffer });
    return tidy(result.value);
  }
  if (name.endsWith(".pdf")) {
    // The worker module registers itself globally, so parsing runs on the main thread without a worker URL.
    await import("pdfjs-dist/build/pdf.worker.min.mjs");
    const pdfjs = await import("pdfjs-dist");
    const task = pdfjs.getDocument({ data: new Uint8Array(buffer) });
    const document = await task.promise;
    const pages: string[] = [];
    for (let index = 1; index <= document.numPages; index += 1) {
      const page = await document.getPage(index);
      const content = await page.getTextContent();
      let line = "";
      const lines: string[] = [];
      for (const item of content.items as Array<{ str?: string; hasEOL?: boolean }>) {
        line += item.str ?? "";
        if (item.hasEOL) {
          lines.push(line);
          line = "";
        }
      }
      if (line) lines.push(line);
      pages.push(lines.join("\n"));
    }
    await task.destroy();
    return tidy(pages.join("\n\n"));
  }
  if (name.endsWith(".txt") || name.endsWith(".md")) return tidy(new TextDecoder().decode(buffer));
  throw new Error("Unsupported file type");
}

function tidy(value: string) {
  return value.replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
