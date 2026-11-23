import { mkdir, readdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import type { FileStorage, StoredFile } from "./file-storage";

function safeKey(root: string, key: string): string {
  const normalized = key.replaceAll("\\", "/").replace(/^\/+/, "");
  if (!normalized || normalized === ".") return root;
  if (normalized.split("/").some((part) => part === ".." || part === "." || part === "")) {
    throw new Error("Der Speicherpfad ist ungültig.");
  }
  const path = resolve(root, normalized);
  if (path !== root && !path.startsWith(`${root}${sep}`)) throw new Error("Der Speicherpfad ist ungültig.");
  return path;
}

export class LocalFileStorage implements FileStorage {
  private readonly root: string;

  constructor(root: string) {
    this.root = resolve(root);
  }

  async put(key: string, contents: Uint8Array): Promise<StoredFile> {
    const path = safeKey(this.root, key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, contents);
    const info = await stat(path);
    return { key, size: info.size, modifiedAt: info.mtime.toISOString() };
  }

  async read(key: string): Promise<Uint8Array> {
    return new Uint8Array(await readFile(safeKey(this.root, key)));
  }

  async getSignedUrl(key: string, _expiresInSeconds: number): Promise<string> {
    safeKey(this.root, key);
    return key;
  }

  async delete(key: string): Promise<void> {
    await unlink(safeKey(this.root, key)).catch(() => undefined);
  }

  async list(prefix = ""): Promise<StoredFile[]> {
    const start = safeKey(this.root, prefix || ".");
    const found: StoredFile[] = [];
    const walk = async (directory: string) => {
      const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
      for (const entry of entries) {
        const path = resolve(directory, entry.name);
        if (entry.isDirectory()) await walk(path);
        else if (entry.isFile()) {
          const info = await stat(path);
          found.push({ key: relative(this.root, path).split(sep).join("/"), size: info.size, modifiedAt: info.mtime.toISOString() });
        }
      }
    };
    await walk(start);
    return found;
  }
}
