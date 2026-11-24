import JSZip from "jszip";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { clientRoot, readManifest, writeManifest, type ClientFile } from "../../../../src/modules/visual-builder/server/client-volume";
import { renderAuthorized } from "../../../../src/modules/visual-builder/server/render-token";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

type ImportEntry = { zipPath: string; role: string; name: string; dest: string };

export async function POST(request: Request) {
  if (!renderAuthorized(request.headers.get("x-render-token"))) {
    return Response.json({ message: "Nicht gefunden." }, { status: 404 });
  }
  const zip = await JSZip.loadAsync(await request.arrayBuffer());
  const meta = zip.file("_import.json");
  if (!meta) return Response.json({ message: "Die Importliste fehlt." }, { status: 400 });
  const body = JSON.parse(await meta.async("string")) as { files?: ImportEntry[]; prune?: boolean; keep?: string[] };
  if (body.prune) {
    const keep = new Set(body.keep ?? []);
    const previous = await readManifest("otelo");
    const files = (previous?.files ?? []).filter((file) => keep.has(file.path) && !file.name.startsWith("."));
    await writeManifest({ slug: "otelo", files });
    return Response.json({ ok: true, total: files.length });
  }
  if (!body.files) return Response.json({ message: "Die Importliste fehlt." }, { status: 400 });
  const root = clientRoot("otelo");
  const previous = await readManifest("otelo");
  const files: ClientFile[] = [...(previous?.files ?? [])];
  const entries = body.files;
  let written = 0;
  for (const entry of entries) {
    if (entry.dest.includes("..") || entry.dest.startsWith("/")) {
      return Response.json({ message: "Ein Zielpfad ist ungültig." }, { status: 400 });
    }
    const packed = zip.file(entry.zipPath);
    if (!packed) continue;
    const target = join(root, entry.dest);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, await packed.async("nodebuffer"));
    const existing = files.findIndex((file) => file.path === entry.dest);
    const record = { role: entry.role, name: entry.name, path: entry.dest };
    if (existing >= 0) files[existing] = record;
    else files.push(record);
    written += 1;
  }
  await writeManifest({ slug: "otelo", files });
  return Response.json({ ok: true, written, total: files.length });
}
