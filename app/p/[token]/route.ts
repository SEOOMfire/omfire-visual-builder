import { loadPreview } from "../../../src/modules/visual-builder/server/previews";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const file = await loadPreview(token).catch(() => null);
  if (!file) return new Response("Der Link ist abgelaufen oder ungültig.", { status: 404 });
  return new Response(new Uint8Array(file.bytes), {
    headers: { "content-type": file.contentType, "cache-control": "private, max-age=3600" },
  });
}
