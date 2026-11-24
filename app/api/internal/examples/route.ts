import { listClientFiles } from "../../../../src/modules/visual-builder/server/client-volume";
import { pingImage } from "../../../../src/modules/visual-builder/server/mcp";
import { renderTemplate } from "../../../../src/modules/visual-builder/server/otelo-render";
import { previewUrl } from "../../../../src/modules/visual-builder/server/public-url";
import { renderAuthorized, renderToken } from "../../../../src/modules/visual-builder/server/render-token";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  if (!renderAuthorized(request.headers.get("x-render-token"))) {
    return Response.json({ message: "Nicht gefunden." }, { status: 404 });
  }
  const payload = await request.json().catch(() => null) as { probe?: boolean; ping?: boolean; only?: string } | null;
  if (payload?.ping) {
    const ping = await pingImage();
    const url = ping.token ? previewUrl(ping.token) : "";
    return Response.json({ url, text: url ? `${ping.note}\n![Testbild](${url})` : ping.note });
  }
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
    const files = await listClientFiles("otelo");
    const figure = files.find((file) => file.role === "figur");
    const product = files.find((file) => file.role === "produkt" && file.name.toLowerCase().endsWith(".png") && !file.name.toLowerCase().includes("logo"));
    const names: Array<"young" | "standard" | "hardware"> = payload?.only === "young" || payload?.only === "standard" || payload?.only === "hardware"
      ? [payload.only]
      : ["young", "standard", "hardware"];
    const sheets = [];
    for (const name of names) {
      const motiv = name === "hardware" ? product?.name : figure?.name;
      if (!motiv) throw new Error("Für das Beispiel fehlt ein Motiv auf dem Volume.");
      sheets.push(await renderTemplate({ name, motiv }));
    }
    return Response.json({
      sheets: sheets.map((sheet) => ({
        name: sheet.name,
        motifName: sheet.motifName,
        contactUrl: previewUrl(sheet.token),
        formats: sheet.formats.map((format) => ({ label: format.label, url: previewUrl(format.token) })),
        hints: sheet.hints.slice(0, 8),
      })),
    });
  } catch (error) {
    const token = request.headers.get("x-render-token") ?? "";
    const raw = error instanceof Error ? error.message : "Der Kontaktbogen ist fehlgeschlagen.";
    const message = raw.split(token).join("TOKEN").replace(/token=[^"&\s<]+/gi, "token=redacted");
    return Response.json({ message }, { status: 500 });
  }
}
