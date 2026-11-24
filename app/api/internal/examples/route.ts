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
  const payload = await request.json().catch(() => null) as { probe?: boolean; ping?: boolean; only?: string; custom?: Record<string, unknown>; publish?: string; glance?: boolean } | null;
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
  if (typeof payload?.publish === "string" && payload.publish.length > 20) {
    const { storePreview } = await import("../../../../src/modules/visual-builder/server/previews");
    const { randomUUID } = await import("node:crypto");
    const token = await storePreview(`${randomUUID()}-vergleich.jpg`, Buffer.from(payload.publish, "base64"));
    return Response.json({ url: previewUrl(token) });
  }
  if (payload?.custom && typeof payload.custom.name === "string" && typeof payload.custom.motiv === "string") {
    try {
      const sheet = await renderTemplate(payload.custom as Parameters<typeof renderTemplate>[0]);
      const glance = payload.glance
        ? await (await import("../../../../src/modules/visual-builder/server/review")).glanceAt(sheet.jpeg, "Vergleiche den Entwurf mit dem Referenzbanner. Höchstens fünf kurze deutsche Sätze.")
        : "";
      return Response.json({
        name: sheet.name,
        motifName: sheet.motifName,
        contactUrl: previewUrl(sheet.token),
        formats: sheet.formats.map((format) => ({ label: format.label, url: previewUrl(format.token) })),
        hints: sheet.hints.slice(0, 12),
        glance,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Der Kontaktbogen ist fehlgeschlagen.";
      return Response.json({ message }, { status: 500 });
    }
  }
  try {
    const files = await listClientFiles("otelo");
    const figure = files.find((file) => file.role === "figur");
    const product = files.find((file) => file.role === "produkt" && /a56|galaxy/i.test(file.name) && file.name.toLowerCase().endsWith(".png"))
      ?? files.find((file) => file.role === "produkt" && file.name.toLowerCase().endsWith(".png") && !file.name.toLowerCase().includes("logo"));
    const names = ["tarif", "product", "product_person", "young"] as const;
    const only = names.find((name) => name === payload?.only);
    const sheets = [];
    for (const name of (only ? [only] : names)) {
      const motiv = name === "tarif" || name === "young" ? figure?.name : product?.name;
      if (!motiv || !figure) throw new Error("Für das Beispiel fehlt ein Motiv auf dem Volume.");
      sheets.push(await renderTemplate({
        name,
        motiv,
        person: name === "product_person" ? figure.name : undefined,
        headline: "UNLIMITED ON DEMAND",
        subline: "100 GB monatlich\ninkl. unendlich oft 1 GB abrufen",
        button: "Jetzt sichern auf **otelo.de**",
        stoererTyp: "tarif",
        preis: "29,99 €",
        preisZusatz: "monatlich¹",
        pflichttext: "Alle Preise inklusive MwSt. · otelo – eine Marke der Vodafone GmbH · Ferdinand-Braun-Platz 1 · 40549 Düsseldorf · otelo.de",
        produktname: "SAMSUNG Galaxy A56 5G",
      }));
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
