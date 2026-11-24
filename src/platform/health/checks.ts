import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import postgres from "postgres";

export type CheckResult = { ok: boolean; detail: string };

export type HealthReport = {
  ok: boolean;
  database: string;
  volume: string;
  chromium: string;
};

const CHROMIUM_TTL_MS = 10 * 60 * 1000;

let chromiumCache: { at: number; result: CheckResult } | null = null;

export function healthReport(parts: { database: CheckResult; volume: CheckResult; chromium: CheckResult }): HealthReport {
  return {
    ok: parts.database.ok && parts.volume.ok && parts.chromium.ok,
    database: parts.database.detail,
    volume: parts.volume.detail,
    chromium: parts.chromium.detail,
  };
}

export async function checkDatabase(): Promise<CheckResult> {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return { ok: false, detail: "DATABASE_URL fehlt." };
  const sql = postgres(url, { max: 1, connect_timeout: 5, idle_timeout: 1, ssl: url.includes("sslmode=require") ? "require" : false });
  try {
    await sql`select 1 as ok`;
    return { ok: true, detail: "erreichbar" };
  } catch {
    return { ok: false, detail: "Die Datenbank ist nicht erreichbar." };
  } finally {
    await sql.end({ timeout: 2 }).catch(() => undefined);
  }
}

export async function checkVolume(): Promise<CheckResult> {
  const root = process.env.FILE_STORAGE_ROOT?.trim();
  if (!root) return { ok: false, detail: "FILE_STORAGE_ROOT fehlt." };
  try {
    await mkdir(root, { recursive: true });
    const directory = await mkdtemp(join(root, ".health-"));
    try {
      await writeFile(join(directory, "probe"), "ok");
      return { ok: true, detail: "beschreibbar" };
    } finally {
      await rm(directory, { recursive: true, force: true }).catch(() => undefined);
    }
  } catch {
    return { ok: false, detail: "Das Volume ist nicht beschreibbar." };
  }
}

function chromiumBinary(): string {
  return process.env.CHROMIUM_PATH?.trim() || process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?.trim() || "chromium";
}

export async function checkChromium(now = Date.now()): Promise<CheckResult> {
  if (chromiumCache && now - chromiumCache.at < CHROMIUM_TTL_MS) return chromiumCache.result;
  const result = await launchChromium();
  if (result.ok) chromiumCache = { at: now, result };
  return result;
}

function launchChromium(): Promise<CheckResult> {
  const binary = chromiumBinary();
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: CheckResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    let child;
    try {
      child = spawn(/*turbopackIgnore: true*/ binary, ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--dump-dom", "about:blank"], {
        stdio: "ignore",
      });
    } catch {
      finish({ ok: false, detail: "Chromium lässt sich nicht starten." });
      return;
    }
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish({ ok: false, detail: "Chromium hat nicht rechtzeitig geantwortet." });
    }, 15_000);
    child.once("error", (error: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      finish({
        ok: false,
        detail: error.code === "ENOENT" ? "Chromium fehlt im Image." : "Chromium lässt sich nicht starten.",
      });
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      finish(code === 0 ? { ok: true, detail: "startbar" } : { ok: false, detail: "Chromium ist mit einem Fehler beendet." });
    });
  });
}

export async function collectHealth(): Promise<HealthReport> {
  const [database, volume, chromium] = await Promise.all([checkDatabase(), checkVolume(), checkChromium()]);
  return healthReport({ database, volume, chromium });
}
