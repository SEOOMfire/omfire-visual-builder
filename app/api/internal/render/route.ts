import { renderInBrowser } from "../../../../src/modules/visual-builder/server/browser-pool";
import { renderAuthorized } from "../../../../src/modules/visual-builder/server/render-token";
import type { RenderJob } from "../../../../src/modules/visual-builder/render-protocol";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  if (!renderAuthorized(request.headers.get("x-render-token"))) {
    return Response.json({ message: "Nicht gefunden." }, { status: 404 });
  }
  const job = await request.json().catch(() => null) as RenderJob | null;
  if (!job || !Array.isArray(job.formats) || !job.state) {
    return Response.json({ message: "Die Render-Anfrage ist unvollständig." }, { status: 400 });
  }
  try {
    const output = await renderInBrowser(job);
    return Response.json(output);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Die Vorschau konnte nicht erzeugt werden.";
    return Response.json({ message }, { status: 503 });
  }
}
