import "server-only";

import type { FileStorage } from "./file-storage";
import { LocalFileStorage } from "./local-file-storage";

export function createFileStorage(): FileStorage {
  const provider = (process.env.FILE_STORAGE_PROVIDER ?? "local").trim().toLowerCase();
  if (provider === "local") {
    const root = process.env.FILE_STORAGE_ROOT?.trim();
    if (!root) throw new Error("FILE_STORAGE_ROOT fehlt.");
    return new LocalFileStorage(root);
  }
  if (provider === "s3") {
    throw new Error("Der S3-Speicher ist vorgesehen und wird mit dem Coolify-Aufbau angeschlossen.");
  }
  throw new Error("FILE_STORAGE_PROVIDER muss local oder s3 sein.");
}
