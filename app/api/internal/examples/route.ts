import { renderTemplate } from "../../../../src/modules/visual-builder/server/otelo-render";
import { renderAuthorized, renderToken } from "../../../../src/modules/visual-builder/server/render-token";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  if (!renderAuthorized(request.headers.get("x-render-token"))) {
    return Response.json({ message: "Nicht gefunden." }, { status: 404 });
  }
  const payload = await request.json().catch(() => null) as { probe?: boolean } | null;
  if (payload?.probe) {
    const token = renderToken();
    const port = process.env.PORT || "3000";
    const response = await fetch(`http://127.0.0.1:${port}/internal/render?token=${encodeURIComponent(token)}`, {
      headers: { "x-render-token": token },
    });
    const text = (await response.text()).split(token).join("TOKEN");
    return Response.json({ status: response.status, body: text.slice(0, 600) });
  }
  try {
    const sheets = [];
    for (const name of ["young", "standard", "hardware"] as const) {
      sheets.push(await renderTemplate(name));
    }
    return Response.json({
      sheets: sheets.map((sheet) => ({ name: sheet.name, token: sheet.token, jpeg: sheet.jpeg, hints: sheet.hints.slice(0, 8) })),
    });
  } catch (error) {
    const token = request.headers.get("x-render-token") ?? "";
    const raw = error instanceof Error ? error.message : "Der Kontaktbogen ist fehlgeschlagen.";
    const message = raw.split(token).join("TOKEN").replace(/token=[^"&\s<]+/gi, "token=redacted");
    return Response.json({ message }, { status: 500 });
  }
}
