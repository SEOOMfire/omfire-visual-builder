import "server-only";

import { cookies } from "next/headers";
import type { Capability } from "../module-contract";
import { runtimeQuery } from "../database/client";
import { createSessionToken, hashSessionToken } from "./passwords";
import type { PlatformPrincipal, RoleScope } from "./capabilities";

const cookieName = "vb-session";
const sessionDays = 7;

type PrincipalRow = {
  user_id: string;
  email: string;
  display_name: string;
  tenant_id: string;
  tenant_slug: string;
  role_id: string;
  role_key: string;
  role_name: string;
  role_scope: RoleScope;
  capabilities: string[] | null;
};

export async function loadPrincipal(): Promise<PlatformPrincipal | null> {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token) return null;
  const rows = await runtimeQuery<PrincipalRow>("select * from private.session_principal($1)", [await hashSessionToken(token)]);
  const session = rows[0];
  if (!session) return null;
  return {
    userId: session.user_id,
    email: session.email,
    displayName: session.display_name,
    tenantId: session.tenant_id,
    tenantSlug: session.tenant_slug,
    roleId: session.role_id,
    roleKey: session.role_key,
    roleName: session.role_name,
    roleScope: session.role_scope,
    capabilities: new Set((session.capabilities ?? []) as Capability[]),
  };
}

export async function startSession(userId: string, tenantId: string): Promise<void> {
  const token = createSessionToken();
  const expiresAt = new Date(Date.now() + sessionDays * 24 * 60 * 60 * 1000);
  await runtimeQuery("select private.open_session($1, $2, $3, $4)", [userId, tenantId, await hashSessionToken(token), expiresAt]);
  (await cookies()).set(cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function storeEmailLink(email: string, tokenHash: string, expiresAt: Date): Promise<void> {
  await runtimeQuery("select private.store_email_link($1, $2, $3)", [email, tokenHash, expiresAt]);
}

export async function consumeEmailLink(tokenHash: string): Promise<string | null> {
  const rows = await runtimeQuery<{ consume_email_link: string | null }>("select private.consume_email_link($1) as consume_email_link", [tokenHash]);
  return rows[0]?.consume_email_link ?? null;
}
