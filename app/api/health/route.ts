import { collectHealth } from "../../../src/platform/health/checks";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const report = await collectHealth();
  return Response.json(report, { status: report.ok ? 200 : 503 });
}
