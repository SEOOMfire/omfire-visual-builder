import "server-only";

import { runtimeQuery } from "../database/client";

export type StaffAccount = { user_id: string; tenant_id: string; email: string };

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function allowedEmail(email: string): boolean {
  const domains = (process.env.ALLOWED_EMAIL_DOMAINS ?? "")
    .split(",")
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);
  if (!domains.length || !emailPattern.test(email)) return false;
  const domain = email.slice(email.lastIndexOf("@") + 1);
  return domains.includes(domain);
}

export async function findStaffAccount(email: string): Promise<StaffAccount | null> {
  const normalized = email.trim().toLowerCase();
  if (!allowedEmail(normalized)) return null;
  const rows = await runtimeQuery<StaffAccount>("select * from private.staff_account($1)", [normalized]);
  return rows[0] ?? null;
}

export async function passwordHashFor(email: string): Promise<string | null> {
  const rows = await runtimeQuery<{ password_hash_for: string | null }>("select private.password_hash_for($1) as password_hash_for", [email]);
  return rows[0]?.password_hash_for ?? null;
}
