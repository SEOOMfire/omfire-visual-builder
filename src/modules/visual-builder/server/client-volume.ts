import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";

export type ClientFile = { role: string; name: string; path: string };

export type ClientManifest = {
  slug: string;
  files: ClientFile[];
};

export function clientRoot(slug = "otelo"): string {
  const root = process.env.FILE_STORAGE_ROOT?.trim();
  if (!root) throw new Error("FILE_STORAGE_ROOT fehlt.");
  return join(root, "clients", slug);
}

export function insideClient(slug: string, relative: string): string {
  const base = resolve(clientRoot(slug));
  const path = resolve(base, relative);
  if (path !== base && !path.startsWith(`${base}${sep}`)) throw new Error("Der Pfad liegt außerhalb des Kundenordners.");
  if (relative.split("/").some((part) => part === ".." || part === "")) throw new Error("Der Pfad ist ungültig.");
  return path;
}

export async function readManifest(slug = "otelo"): Promise<ClientManifest | null> {
  try {
    const raw = await readFile(join(clientRoot(slug), "manifest.json"), "utf8");
    return JSON.parse(raw) as ClientManifest;
  } catch {
    return null;
  }
}

export async function writeManifest(manifest: ClientManifest): Promise<void> {
  const root = clientRoot(manifest.slug);
  await mkdir(root, { recursive: true });
  await writeFile(join(root, "manifest.json"), JSON.stringify(manifest, null, 2));
}

export async function readClientFile(slug: string, relative: string): Promise<Buffer> {
  return readFile(insideClient(slug, relative));
}

export async function listClientFiles(slug: string, role?: string): Promise<ClientFile[]> {
  const manifest = await readManifest(slug);
  const files = manifest?.files ?? [];
  return role ? files.filter((file) => file.role === role) : files;
}

export async function saveClientText(slug: string, name: string, text: string): Promise<void> {
  const path = insideClient(slug, name);
  await mkdir(clientRoot(slug), { recursive: true });
  await writeFile(path, text);
}

export async function readClientText(slug: string, name: string): Promise<string | null> {
  try {
    return await readFile(insideClient(slug, name), "utf8");
  } catch {
    return null;
  }
}

export async function motifNames(slug: string): Promise<string[]> {
  const files = await listClientFiles(slug);
  return files.filter((file) => file.role === "figur" || file.role === "produkt" || file.role === "hintergrund").map((file) => file.name);
}

export async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
  await readdir(path);
}
