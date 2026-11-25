import { adjustCreative, readDraft, saveCreative, signedPath, storeRenderedDraft, writeDraft } from "../../src/modules/visual-builder/server/creative-archive";
import { MCP_INSTRUCTIONS, bearerToken, pingImage, principalFromToken, systemStatus } from "../../src/modules/visual-builder/server/mcp";
import { markdownPreview } from "../../src/modules/visual-builder/server/preview-text";
import { previewUrl } from "../../src/modules/visual-builder/server/public-url";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const TOOLS = [
  { name: "ping_image", description: "Gibt ein kleines Testbild zurück, damit sichtbar wird, ob Bilder im Chat ankommen.", inputSchema: { type: "object", properties: {} } },
  { name: "system_status", description: "Sagt in Klartext, was bereit ist und was noch fehlt.", inputSchema: { type: "object", properties: {} } },
  { name: "list_clients", description: "Kunden, auf die diese Person Zugriff hat.", inputSchema: { type: "object", properties: {} } },
  { name: "brand_assets", description: "Logos, Buttons, Störer, Schriften, Sprachen und Vorlagen eines Kunden.", inputSchema: { type: "object", required: ["kunde"], properties: { kunde: { type: "string" } } } },
  { name: "search_motifs", description: "Sucht Motive nach Name, Ordner oder Ausrichtung.", inputSchema: { type: "object", required: ["kunde"], properties: { kunde: { type: "string" }, suche: { type: "string" } } } },
  { name: "compose_creative", description: "Baut einen Entwurf. Felder immer setzen, wenn der Nutzer sie nennt: headline, unterzeile, datenmenge, datenmenge_alt, preis, preis_zusatz, stern_text, deko, einmalpreis, einmalpreis_zusatz, geraet_name, button, kampagne. Vorlagen: tarif, young, product, product_person, kachel_person, kachel_geraet, kachel_geraet_person. deko ist bw_wellen, fruehling_blaetter oder keine. Kampagne BW setzt Wellen, fruehling_sommer die Blätter.", inputSchema: { type: "object", required: ["kunde", "vorlage", "motiv"], properties: { kunde: { type: "string", description: "Kunde, zum Beispiel otelo." }, vorlage: { type: "string", description: "tarif, young, product, product_person, kachel_person, kachel_geraet oder kachel_geraet_person." }, motiv: { type: "string", description: "Dateiname des Motivs." }, person: { type: "string", description: "Person, wenn das Gerät ein eigenes Motiv ist." }, headline: { type: "string", description: "Headline, zum Beispiel BLACK WEEK." }, subline: { type: "string", description: "Unterzeile." }, unterzeile: { type: "string", description: "Unterzeile, gleicher Inhalt wie subline." }, button: { type: "string", description: "Text der CTA-Leiste. Leer lässt die Leiste weg." }, kampagne: { type: "string", description: "BW oder fruehling_sommer." }, datenmenge: { type: "string", description: "Datenmenge im grünen Teil, zum Beispiel 150 GB." }, datenmenge_alt: { type: "string", description: "Durchgestrichener Altwert, zum Beispiel 50 GB." }, preis: { type: "string", description: "Preis, zum Beispiel 19,99 €." }, preis_zusatz: { type: "string", description: "Zusatz unter dem Preis, Standard pro Monat." }, einmalpreis: { type: "string", description: "Einmalpreis der Gerät-Kachel." }, einmalpreis_zusatz: { type: "string", description: "Zusatz zum Einmalpreis." }, preis_alt: { type: "string", description: "Alter Einmalpreis für statt, nur wenn er höher ist als der neue." }, energielabel: { type: "string", description: "Energieklasse A bis G." }, stern_text: { type: "string", description: "Text im Stern, zum Beispiel YOUNG DEAL." }, deko: { type: "string", description: "bw_wellen, fruehling_blaetter oder keine." }, geraet_name: { type: "string", description: "Gerätename unten rechts." }, stoerer_typ: { type: "string" }, aktion_text: { type: "string" }, pflichttext: { type: "string" }, headline_variante: { type: "string" }, orange: { type: "string" }, produktname: { type: "string" } } } },
  { name: "adjust_creative", description: "Ändert jedes sichtbare Detail per Sprache. Den Satz unverändert in anweisung oder aenderung.text geben. Texte, Sichtbarkeit, Farben der Markenpalette, Lage, Größe, Deko, Vorlage, Motiv, Formate und Versionen. Beispiele: CTA: Jetzt wechseln. Stern weg. Unterzeile in Lime. Headline kleiner nur im 9x16. nimm Blätter statt Wellen. Gerät statt Person: Galaxy A56. zurück zu Version 2. Unklare Teile werden nachgefragt, nie verworfen. Ohne Änderung keine neue Version.", inputSchema: { type: "object", required: ["entwurf"], properties: { entwurf: { type: "string", description: "Entwurfs-ID." }, anweisung: { type: "string", description: "Der Satz des Nutzers, unverändert." }, aenderung: { type: "object", description: "Alternativ ein Objekt mit text: der Satz des Nutzers." } } } },
  { name: "help_adjust", description: "Listet alle Elemente, Eigenschaften und Beispielsätze für adjust_creative.", inputSchema: { type: "object", properties: {} } },
  { name: "translate", description: "Überträgt die Texte eines Entwurfs in weitere Sprachen.", inputSchema: { type: "object", required: ["entwurf", "sprachen"], properties: { entwurf: { type: "string" }, sprachen: { type: "array", items: { type: "string" } } } } },
  { name: "check_guidelines", description: "Prüft die Texte eines Entwurfs gegen die CI-Richtlinie.", inputSchema: { type: "object", required: ["entwurf"], properties: { entwurf: { type: "string" } } } },
  { name: "save_creative", description: "Speichert die PNG-Dateien und ein ZIP auf dem Volume und liefert signierte Links. Es wird nichts nach Drive geschrieben.", inputSchema: { type: "object", required: ["entwurf"], properties: { entwurf: { type: "string" }, kampagne: { type: "string" } } } },
  { name: "check_batch", description: "Prüft jede Zeile einer CSV, ohne Dateien zu erzeugen.", inputSchema: { type: "object", required: ["kunde", "datei"], properties: { kunde: { type: "string" }, datei: { type: "string" } } } },
  { name: "run_batch", description: "Startet den geprüften Stapel im Hintergrund.", inputSchema: { type: "object", required: ["kunde", "datei"], properties: { kunde: { type: "string" }, datei: { type: "string" }, nur_zeilen: { type: "array", items: { type: "integer" } } } } },
  { name: "batch_status", description: "Fortschritt eines Hintergrundauftrags.", inputSchema: { type: "object", required: ["auftrag"], properties: { auftrag: { type: "string" } } } },
  { name: "list_archive", description: "Letzte Werbemittel eines Kunden.", inputSchema: { type: "object", required: ["kunde"], properties: { kunde: { type: "string" }, kampagne: { type: "string" } } } },
] as const;

type ToolName = (typeof TOOLS)[number]["name"];

function rpc(id: unknown, result: unknown) {
  return Response.json({ jsonrpc: "2.0", id, result });
}

function fail(id: unknown, message: string) {
  return Response.json({ jsonrpc: "2.0", id, error: { code: -32000, message } });
}

function renderedText(intro: string, rendered: { motifName: string; token: string; formats: Array<{ label: string; token: string }>; hints: string[]; buttonName: string | null }, extra?: string) {
  return markdownPreview({
    intro,
    motifName: rendered.motifName,
    contactUrl: previewUrl(rendered.token),
    formats: rendered.formats.map((format) => ({ label: format.label, url: previewUrl(format.token) })),
    hints: rendered.hints,
    extra: [rendered.buttonName ? `Button: ${rendered.buttonName}` : "", extra ?? ""].filter(Boolean).join(" "),
  });
}

function instructedText(draft: { layoutBook?: { snap: { fields?: { sublineColor?: string; datenmengeAlt?: string; deko?: string; button?: string }; nudges?: Record<string, Partial<Record<string, { hidden?: boolean }>>> } } }): string {
  const fields = draft.layoutBook?.snap.fields ?? {};
  const hidden = (element: string) => Object.values(draft.layoutBook?.snap.nudges ?? {}).some((bucket) => bucket?.[element]?.hidden);
  const notes = [
    fields.sublineColor?.toLowerCase() === "#d7eb00" ? "Unterzeile ist auf Wunsch Lime." : "",
    hidden("stoerer") ? "Störer ist auf Wunsch ausgeblendet." : "",
    fields.datenmengeAlt === "" ? "Altwert ist auf Wunsch entfernt." : "",
    fields.deko === "fruehling_blaetter" ? "Deko ist auf Wunsch Blätter." : "",
    fields.deko === "keine" ? "Deko ist auf Wunsch keine." : "",
    fields.button ? `CTA ist auf Wunsch „${fields.button}“.` : "",
    hidden("pfeile") ? "Pfeile sind auf Wunsch ausgeblendet." : "",
  ].filter(Boolean);
  return notes.join(" ");
}

async function attachReview(draft: { vorlage?: string; glance?: string; hints: string[]; layoutBook?: { snap: { fields?: { sublineColor?: string; datenmengeAlt?: string; deko?: string; button?: string }; nudges?: Record<string, Partial<Record<string, { hidden?: boolean }>>> } } }, measured: string[], formats: Array<{ label: string; pngBase64: string }>, measureText = ""): Promise<string> {
  const { readClientText } = await import("../../src/modules/visual-builder/server/client-volume");
  const { glanceFormats, pruefungText } = await import("../../src/modules/visual-builder/server/review");
  const rules = await readClientText("otelo", "ci-richtlinie.md").catch(() => "");
  const reference = draft.vorlage === "kachel_geraet" || draft.vorlage === "kachel_geraet_person"
    ? "files/referenz/banner/Meta_Q4_1126_BW_i17_Young_1x1.png"
    : draft.vorlage?.startsWith("kachel")
      ? "files/referenz/banner/Meta_Q4_1126_BW_Young_Classic_Woman_1x1.png"
      : "files/referenz/styleguide-seite-4.jpg";
  draft.glance = await glanceFormats(formats.map((format) => ({ label: format.label, jpeg: format.pngBase64 })), rules ?? "", reference, measureText, instructedText(draft).trim());
  draft.hints = measured;
  await writeDraft(draft as Parameters<typeof writeDraft>[0]);
  return pruefungText(measured, draft.glance);
}

async function callTool(name: ToolName, args: Record<string, unknown>): Promise<{ text: string; image?: string; mime?: string }> {
  if (name === "ping_image") {
    const ping = await pingImage();
    const link = ping.token ? previewUrl(ping.token) : "";
    return { text: link ? `${ping.note}\n![Testbild](${link})` : ping.note, image: ping.base64 };
  }
  if (name === "system_status") return { text: await systemStatus() };
  if (name === "help_adjust") {
    const { ADJUST_HELP } = await import("../../src/modules/visual-builder/server/adjust-commands");
    return { text: ADJUST_HELP };
  }
  if (name === "list_clients") {
    const { listClientFiles } = await import("../../src/modules/visual-builder/server/client-volume");
    const files = await listClientFiles("otelo").catch(() => []);
    return { text: files.length ? "otelo" : "Noch kein Kunde auf dem Volume." };
  }
  if (name === "brand_assets") {
    const { brandSummary } = await import("../../src/modules/visual-builder/server/otelo-render");
    return { text: await brandSummary() };
  }
  if (name === "search_motifs") {
    const { motifNames } = await import("../../src/modules/visual-builder/server/client-volume");
    const { motifQueryMatches } = await import("../../src/modules/visual-builder/server/motif");
    const query = String(args.suche ?? "");
    const names = (await motifNames("otelo")).filter((name) => motifQueryMatches(name, query) || name.toLowerCase().includes(query.toLowerCase()));
    return { text: names.length ? names.slice(0, 30).join(", ") : "Kein Motiv mit diesem Namen." };
  }
  if (name === "compose_creative") {
    const { renderTemplate } = await import("../../src/modules/visual-builder/server/otelo-render");
    const { creativeInput } = await import("../../src/modules/visual-builder/server/creative-archive");
    const fields = creativeInput(args);
    const rendered = await renderTemplate({
      name: String(args.vorlage ?? "young"),
      motiv: String(args.motiv ?? ""),
      ...fields,
    });
    const { defaultHeadline, defaultOrange, defaultStoerer, normalizeVorlage } = await import("../../src/modules/visual-builder/otelo-scene");
    const name = normalizeVorlage(String(args.vorlage ?? "young"));
    const draft = await storeRenderedDraft(rendered, {
      motiv: String(args.motiv ?? ""),
      person: fields.person ?? "",
      headline: fields.headline ?? "",
      subline: fields.subline ?? "",
      button: fields.button ?? "",
      kampagne: fields.kampagne ?? "",
      stoererTyp: (fields.stoererTyp as "tarif") || defaultStoerer(name),
      preis: fields.preis ?? "29,99 €",
      preisZusatz: fields.preisZusatz ?? "pro Monat",
      einmalpreis: fields.einmalpreis ?? "",
      aktionText: fields.aktionText ?? "",
      pflichttext: fields.pflichttext ?? "",
      headlineVariante: fields.headlineVariante === "box" ? "box" : fields.headlineVariante === "direkt" ? "direkt" : defaultHeadline(name),
      orange: fields.orange === "links" ? "links" : fields.orange === "rechts" ? "rechts" : defaultOrange(name),
      produktname: fields.produktname ?? "",
      datenmenge: fields.datenmenge,
      datenmengeAlt: fields.datenmengeAlt,
      einmalpreisZusatz: fields.einmalpreisZusatz,
      preisAlt: fields.preisAlt,
      energielabel: fields.energielabel,
      sternText: fields.sternText,
      deko: fields.deko,
      geraetName: fields.geraetName,
    });
    const checked = await attachReview(draft, rendered.hints, rendered.formats, rendered.measureText);
    const ask = rendered.motifNote ? `${rendered.motifNote}\n` : "";
    return { text: `${ask}${renderedText(`Entwurf ${rendered.name}. ID ${draft.id}.`, rendered)}\n${checked}`, image: rendered.jpeg, mime: "image/jpeg" };
  }
  if (name === "adjust_creative") {
    const { adjustRequest } = await import("../../src/modules/visual-builder/server/adjust-commands");
    const spoken = adjustRequest(args);
    const nested = args.aenderung && typeof args.aenderung === "object" ? args.aenderung as Record<string, unknown> : {};
    console.info(`adjust_creative schluessel=${Object.keys(args).join(",") || "-"} anweisung=${spoken ? "ja" : "nein"}`);
    const { draft, rendered } = await adjustCreative(String(args.entwurf ?? ""), { ...nested, ...(spoken ? { text: spoken } : {}) });
    const checked = await attachReview(draft, rendered.hints, rendered.formats, rendered.measureText);
    const summary = draft.summary ? `${draft.summary}\n` : "";
    return { text: `${summary}${renderedText(`Entwurf ${draft.id}, Version ${draft.layoutBook?.version ?? 1}.`, rendered)}\n${checked}`, image: rendered.jpeg, mime: "image/jpeg" };
  }
  if (name === "save_creative") {
    const id = String(args.entwurf ?? "");
    if (typeof args.kampagne === "string" && args.kampagne.trim()) {
      const existing = await readDraft(id);
      if (existing) {
        existing.kampagne = args.kampagne;
        await writeDraft(existing);
      }
    }
    const saved = await saveCreative(id);
    const links = saved.files.map((file) => `[${file.label}](${previewUrl(signedPath(file.relative))})`).join(" ");
    const zip = `[ZIP](${previewUrl(signedPath(saved.zipRelative))})`;
    return { text: `Gespeichert als ${saved.quarter} ${saved.monthYear}.\nMotiv: ${saved.draft.motiv}\n${links}\n${zip}` };
  }
  if (name === "check_guidelines") {
    const { checkOteloCopy } = await import("../../src/modules/visual-builder/server/otelo-rules");
    const { readClientText } = await import("../../src/modules/visual-builder/server/client-volume");
    const { blockingHints } = await import("../../src/modules/visual-builder/server/creative-archive");
    const id = String(args.entwurf ?? "");
    const draft = /^[0-9a-f-]{36}$/i.test(id) ? await readDraft(id) : null;
    const findings = checkOteloCopy(draft ? `${draft.headline}\n${draft.subline}` : String(args.text ?? args.headline ?? ""));
    const layout = draft ? blockingHints(draft.hints) : [];
    const ready = await readClientText("otelo", "ci-richtlinie.md");
    if (!ready) return { text: "Die CI-Richtlinie für otelo liegt noch nicht auf dem Volume." };
    const { fullReport } = await import("../../src/modules/visual-builder/server/review");
    return { text: fullReport([...(draft?.hints ?? []), ...findings.map((finding) => finding.message), ...layout], draft?.glance ?? "") };
  }
  if (name === "check_batch") {
    const { inspectBatch } = await import("../../src/modules/visual-builder/server/csv-batch");
    const parsed = inspectBatch(String(args.text ?? args.inhalt ?? ""));
    if (parsed.errors.length) return { text: parsed.errors.join(" ") };
    return { text: `${parsed.rows.length} von ${parsed.rows.length} Zeilen sind lesbar. Danach run_batch mit derselben CSV.` };
  }
  if (name === "run_batch") {
    const { runCreativeBatch } = await import("../../src/modules/visual-builder/server/batch-run");
    const result = await runCreativeBatch(String(args.text ?? args.inhalt ?? ""));
    const sheets = result.contacts.map((url, index) => `[Kontakt ${index + 1}](${url})`).join(" ");
    return { text: `${result.summary}\n[ZIP](${result.url})\n${sheets}` };
  }
  return { text: "Dieser Schritt ist noch nicht an der Reihe. compose_creative, adjust_creative und save_creative arbeiten auf dem Volume." };
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
  if (!secret) return fail(body.id, "Der Aufruf braucht einen API-Schlüssel. Lege ihn im Coolify-Terminal an: npm run create-key -- --email … --name … --tenant otelo. Sende ihn als Authorization: Bearer oder x-api-key.");
  const person = await principalFromToken(secret).catch(() => null);
  if (!person) return fail(body.id, "Der API-Schlüssel ist ungültig oder widerrufen.");
  const name = body.params?.name as ToolName | undefined;
  if (!name || !TOOLS.some((tool) => tool.name === name)) return fail(body.id, "Dieses Werkzeug kenne ich nicht.");
  let result: { text: string; image?: string; mime?: string };
  try {
    result = await callTool(name, body.params?.arguments ?? {});
  } catch (error) {
    const message = error instanceof Error ? error.message : "Der Aufruf ist fehlgeschlagen.";
    return fail(body.id, message);
  }
  const content: Array<{ type: string; text?: string; data?: string; mimeType?: string }> = [{ type: "text", text: result.text }];
  if (result.image) content.push({ type: "image", data: result.image, mimeType: result.mime ?? "image/png" });
  return rpc(body.id, { content, isError: false });
}

export async function GET() {
  return Response.json({ name: "visual-builder", transport: "streamable-http" });
}

export async function DELETE() {
  return new Response(null, { status: 204 });
}
