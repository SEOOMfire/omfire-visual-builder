import { NextResponse } from "next/server";
import { findStaffAccount } from "../../../src/platform/auth/directory";
import { hashSessionToken } from "../../../src/platform/auth/passwords";
import { consumeEmailLink, startSession } from "../../../src/platform/auth/session";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const login = new URL("/login", request.url);
  if (!token) return NextResponse.redirect(login);
  const email = await consumeEmailLink(await hashSessionToken(token)).catch(() => null);
  const account = email ? await findStaffAccount(email) : null;
  if (!account) return NextResponse.redirect(login);
  await startSession(account.user_id, account.tenant_id);
  return NextResponse.redirect(new URL("/visual-builder", request.url));
}
