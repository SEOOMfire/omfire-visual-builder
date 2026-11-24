import { collectHealth } from "../../../src/platform/health/checks";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const report = await collectHealth();
    return Response.json(report, { status: report.ok ? 200 : 503 });
  } catch {
    return Response.json(
      { ok: false, database: "Die Prüfung ist fehlgeschlagen.", volume: "Die Prüfung ist fehlgeschlagen.", chromium: "Die Prüfung ist fehlgeschlagen." },
      { status: 503 },
    );
  }
}
