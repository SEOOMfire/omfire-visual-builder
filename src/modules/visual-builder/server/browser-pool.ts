import { chromium, type Browser } from "playwright-core";
import type { RenderJob, RenderOutput } from "../render-protocol";
import { renderToken } from "./render-token";

const slots = Math.max(1, Number(process.env.RENDER_CONCURRENCY || 2) || 2);
let browserPromise: Promise<Browser> | null = null;
let active = 0;
const queue: Array<() => void> = [];

function launch(): Promise<Browser> {
  if (!browserPromise) {
    const executablePath = process.env.CHROMIUM_PATH?.trim() || process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?.trim() || "/usr/bin/chromium";
    browserPromise = chromium.launch({
      executablePath,
      args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    }).catch((error: unknown) => {
      browserPromise = null;
      throw error;
    });
  }
  return browserPromise;
}

async function withSlot<T>(task: () => Promise<T>): Promise<T> {
  if (active >= slots) await new Promise<void>((resolve) => queue.push(resolve));
  active += 1;
  try {
    return await task();
  } finally {
    active -= 1;
    queue.shift()?.();
  }
}

export async function renderInBrowser(job: RenderJob): Promise<RenderOutput> {
  const token = renderToken();
  if (!token) throw new Error("Die Vorschau ist nicht freigegeben. APP_RUNTIME_PASSWORD fehlt.");
  return withSlot(async () => {
    const browser = await launch();
    const context = await browser.newContext({ extraHTTPHeaders: { "x-render-token": token } });
    const page = await context.newPage();
    try {
      const port = process.env.PORT || "3000";
      const target = `http://127.0.0.1:${port}/internal/render?token=${encodeURIComponent(token)}`;
      let response = null;
      try {
        response = await page.goto(target, { waitUntil: "domcontentloaded", timeout: 30_000 });
      } catch {
        const snippet = await page.content().then((html) => html.replace(/token=[^"&\s<]+/gi, "token=redacted").slice(0, 400)).catch(() => "");
        throw new Error(`Die Render-Seite ist intern nicht erreichbar. ${snippet}`.trim());
      }
      if (!response || response.status() >= 400) {
        throw new Error(`Die Render-Seite ist intern nicht erreichbar (${response?.status() ?? "keine Antwort"}).`);
      }
      await page.waitForFunction("window.__vbReady === true", undefined, { timeout: 15_000 });
      return await page.evaluate((payload) => {
        const render = (window as unknown as { __vbRender?: (job: RenderJob) => Promise<RenderOutput> }).__vbRender;
        if (!render) throw new Error("Die Render-Seite ist noch nicht bereit.");
        return render(payload);
      }, job);
    } finally {
      await context.close().catch(() => undefined);
    }
  });
}
