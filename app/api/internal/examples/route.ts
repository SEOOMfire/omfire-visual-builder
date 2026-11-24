import { renderTemplate } from "../../../../src/modules/visual-builder/server/otelo-render";
import { renderAuthorized } from "../../../../src/modules/visual-builder/server/render-token";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  if (!renderAuthorized(request.headers.get("x-render-token"))) {
    return Response.json({ message: "Nicht gefunden." }, { status: 404 });
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
    const message = error instanceof Error ? error.message : "Der Kontaktbogen ist fehlgeschlagen.";
    return Response.json({ message }, { status: 500 });
  }
}
