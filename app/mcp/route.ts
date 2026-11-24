import { MCP_INSTRUCTIONS, bearerToken, driveNextStep, pingImage, principalFromToken, systemStatus } from "../../src/modules/visual-builder/server/mcp";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TOOLS = [
  { name: "ping_image", description: "Gibt ein kleines Testbild zurück, damit sichtbar wird, ob Bilder im Chat ankommen.", inputSchema: { type: "object", properties: {} } },
  { name: "system_status", description: "Sagt in Klartext, was bereit ist und was noch fehlt.", inputSchema: { type: "object", properties: {} } },
  { name: "list_clients", description: "Kunden, auf die diese Person Zugriff hat.", inputSchema: { type: "object", properties: {} } },
  { name: "init_client", description: "Legt die Drive-Ordnerstruktur und Beispieldateien für einen neuen Kunden an.", inputSchema: { type: "object", required: ["kunde"], properties: { kunde: { type: "string" } } } },
  { name: "sync_client", description: "Liest _system eines Kunden und schreibt den gültigen Stand in den Zwischenspeicher.", inputSchema: { type: "object", required: ["kunde"], properties: { kunde: { type: "string" } } } },
  { name: "brand_assets", description: "Logos, Buttons, Störer, Schriften, Sprachen und Vorlagen eines Kunden.", inputSchema: { type: "object", required: ["kunde"], properties: { kunde: { type: "string" } } } },
  { name: "search_motifs", description: "Sucht Motive nach Name, Ordner oder Ausrichtung.", inputSchema: { type: "object", required: ["kunde"], properties: { kunde: { type: "string" }, suche: { type: "string" } } } },
  { name: "compose_creative", description: "Baut einen Entwurf aus Vorlage, Motiv und Texten. Liefert Kontaktbogen, Links, Hinweise und eine Entwurfs-ID.", inputSchema: { type: "object", required: ["kunde", "vorlage", "motiv"], properties: { kunde: { type: "string" }, vorlage: { type: "string" }, motiv: { type: "string" }, headline: { type: "string" }, subline: { type: "string" }, button: { type: "string" }, kampagne: { type: "string" } } } },
  { name: "adjust_creative", description: "Ändert einen Entwurf und liefert eine neue Vorschau.", inputSchema: { type: "object", required: ["entwurf"], properties: { entwurf: { type: "string" }, aenderung: { type: "object" } } } },
  { name: "translate", description: "Überträgt die Texte eines Entwurfs in weitere Sprachen.", inputSchema: { type: "object", required: ["entwurf", "sprachen"], properties: { entwurf: { type: "string" }, sprachen: { type: "array", items: { type: "string" } } } } },
  { name: "check_guidelines", description: "Prüft die Texte eines Entwurfs gegen die CI-Richtlinie.", inputSchema: { type: "object", required: ["entwurf"], properties: { entwurf: { type: "string" } } } },
  { name: "save_creative", description: "Speichert nur einen bestandenen Entwurf und legt die Dateien im Drive ab. Sonst nur Hinweise.", inputSchema: { type: "object", required: ["entwurf"], properties: { entwurf: { type: "string" }, kampagne: { type: "string" } } } },
  { name: "check_batch", description: "Prüft jede Zeile einer CSV, ohne Dateien zu erzeugen.", inputSchema: { type: "object", required: ["kunde", "datei"], properties: { kunde: { type: "string" }, datei: { type: "string" } } } },
  { name: "run_batch", description: "Startet den geprüften Stapel im Hintergrund.", inputSchema: { type: "object", required: ["kunde", "datei"], properties: { kunde: { type: "string" }, datei: { type: "string" }, nur_zeilen: { type: "array", items: { type: "integer" } } } } },
  { name: "batch_status", description: "Fortschritt eines Hintergrundauftrags.", inputSchema: { type: "object", required: ["auftrag"], properties: { auftrag: { type: "string" } } } },
  { name: "list_archive", description: "Letzte Werbemittel eines Kunden.", inputSchema: { type: "object", required: ["kunde"], properties: { kunde: { type: "string" }, kampagne: { type: "string" } } } },
  { name: "open_in_editor", description: "Link zum Entwurf oder Archiv-Eintrag im Editor.", inputSchema: { type: "object", properties: { entwurf: { type: "string" }, archiv: { type: "string" } } } },
] as const;

type ToolName = (typeof TOOLS)[number]["name"];

function rpc(id: unknown, result: unknown) {
  return Response.json({ jsonrpc: "2.0", id, result });
}

function fail(id: unknown, message: string) {
  return Response.json({ jsonrpc: "2.0", id, error: { code: -32000, message } });
}

async function callTool(name: ToolName, args: Record<string, unknown>, origin: string): Promise<{ text: string; image?: string }> {
  if (name === "ping_image") {
    const ping = await pingImage();
    const link = ping.token ? `${origin}/p/${ping.token}` : "";
    return { text: link ? `${ping.note} ${link}` : ping.note, image: ping.base64 };
  }
  if (name === "system_status") return { text: await systemStatus() };
  const missing = driveNextStep() || "Für diesen Kunden ist noch nichts synchronisiert. Ruf sync_client auf, sobald der Ordner im Drive liegt.";
  if (name === "init_client" || name === "sync_client" || name === "brand_assets" || name === "search_motifs" || name === "compose_creative" || name === "adjust_creative" || name === "translate" || name === "check_guidelines" || name === "save_creative" || name === "check_batch" || name === "run_batch" || name === "batch_status" || name === "list_archive" || name === "list_clients" || name === "open_in_editor") {
    if (name === "list_clients") return { text: `${await systemStatus()} Eine Kundenliste gibt es, sobald der Wurzelordner verbunden ist.` };
    return { text: missing };
  }
  return { text: "Dieses Werkzeug kenne ich nicht." };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { jsonrpc?: string; id?: unknown; method?: string; params?: { name?: string; arguments?: Record<string, unknown>; protocolVersion?: string } } | null;
  if (!body || body.jsonrpc !== "2.0" || !body.method) return fail(null, "Die Anfrage ist kein MCP-Aufruf.");
  if (body.method === "initialize") {
    return rpc(body.id, {
      protocolVersion: body.params?.protocolVersion ?? "2025-03-26",
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "visual-builder", version: "0.2.0" },
      instructions: MCP_INSTRUCTIONS,
    });
  }
  if (body.method === "notifications/initialized") return new Response(null, { status: 202 });
  if (body.method === "tools/list") {
    return rpc(body.id, { tools: TOOLS.map((tool) => ({ name: tool.name, description: tool.description, inputSchema: tool.inputSchema })) });
  }
  if (body.method !== "tools/call") return fail(body.id, "Diese MCP-Methode wird nicht unterstützt.");
  const secret = bearerToken(request);
  if (!secret) return fail(body.id, "Der Aufruf braucht einen API-Schlüssel. Lege ihn unter /konto an und sende Authorization: Bearer oder x-api-key.");
  const person = await principalFromToken(secret).catch(() => null);
  if (!person) return fail(body.id, "Der API-Schlüssel ist ungültig oder widerrufen.");
  const name = body.params?.name as ToolName | undefined;
  if (!name || !TOOLS.some((tool) => tool.name === name)) return fail(body.id, "Dieses Werkzeug kenne ich nicht.");
  const origin = new URL(request.url).origin;
  const result = await callTool(name, body.params?.arguments ?? {}, origin);
  const content: Array<{ type: string; text?: string; data?: string; mimeType?: string }> = [{ type: "text", text: result.text }];
  if (result.image) content.push({ type: "image", data: result.image, mimeType: "image/png" });
  return rpc(body.id, { content, isError: false });
}

export async function GET() {
  return Response.json({ name: "visual-builder", transport: "streamable-http" });
}

export async function DELETE() {
  return new Response(null, { status: 204 });
}
