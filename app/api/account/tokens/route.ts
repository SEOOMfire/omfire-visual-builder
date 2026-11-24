import { NextResponse } from "next/server";
import { loadPrincipal } from "../../../../src/platform/auth/session";
import { tenantQuery } from "../../../../src/platform/database/client";
import { databaseContext } from "../../../../src/modules/visual-builder/server/access";
import { newApiToken } from "../../../../src/modules/visual-builder/server/mcp";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const principal = await loadPrincipal();
  if (!principal) return NextResponse.json({ message: "Bitte anmelden." }, { status: 401 });
  const rows = await tenantQuery<{ id: string; name: string; prefix: string; created_at: string; revoked_at: string | null; last_used_at: string | null }>(
    databaseContext(principal),
    `select id, name, prefix, created_at, revoked_at, last_used_at
       from public.api_tokens
      where tenant_id = $1 and user_id = $2
      order by created_at desc`,
    [principal.tenantId, principal.userId],
  );
  return NextResponse.json({ tokens: rows });
}

export async function POST(request: Request) {
  const principal = await loadPrincipal();
  if (!principal) return NextResponse.json({ message: "Bitte anmelden." }, { status: 401 });
  const body = await request.json().catch(() => null) as { name?: string } | null;
  const name = body?.name?.trim() || "Langdock";
  const token = newApiToken();
  await tenantQuery(
    databaseContext(principal),
    `insert into public.api_tokens (tenant_id, user_id, name, prefix, token_hash)
     values ($1, $2, $3, $4, $5)`,
    [principal.tenantId, principal.userId, name.slice(0, 80), token.prefix, token.hash],
  );
  return NextResponse.json({ secret: token.secret, prefix: token.prefix, message: "Der Schlüssel wird nur dieses eine Mal angezeigt." });
}
