import { NextResponse } from "next/server";
import { allowedEmail, findStaffAccount, passwordHashFor } from "../../../../src/platform/auth/directory";
import { verifyPassword, createSessionToken, hashSessionToken } from "../../../../src/platform/auth/passwords";
import { startSession, storeEmailLink } from "../../../../src/platform/auth/session";

function method(): "email_link" | "password" | "both" {
  const value = process.env.AUTH_LOGIN_METHOD?.trim();
  if (value === "password" || value === "both" || value === "email_link") return value;
  return "email_link";
}

async function deliver(email: string, link: string): Promise<void> {
  const delivery = process.env.AUTH_EMAIL_DELIVERY?.trim() || "log";
  if (delivery === "log") {
    if (process.env.NODE_ENV === "production") throw new Error("AUTH_EMAIL_DELIVERY=log ist im Betrieb nicht erlaubt.");
    console.info(`Anmeldelink für ${email}: ${link}`);
    return;
  }
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!key || !from) throw new Error("Der Mailversand ist nicht eingerichtet.");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: email,
      subject: "Anmeldung Visual Builder",
      text: `Über diesen Link meldest du dich an. Er gilt 20 Minuten.\n\n${link}`,
    }),
  });
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error("Die Nachricht konnte nicht verschickt werden.");
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { email?: unknown; password?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const login = method();
  try {
    if (password && login !== "email_link") {
      const account = allowedEmail(email) ? await findStaffAccount(email) : null;
      const hash = account ? await passwordHashFor(email) : null;
      if (!account || !(await verifyPassword(password, hash))) {
        return NextResponse.json({ error: "Anmeldung abgelehnt." }, { status: 401 });
      }
      await startSession(account.user_id, account.tenant_id);
      return NextResponse.json({ ok: true });
    }
    if (login === "password") return NextResponse.json({ error: "Anmeldung abgelehnt." }, { status: 401 });
    const account = await findStaffAccount(email);
    if (account) {
      const token = createSessionToken();
      const origin = process.env.APP_ORIGIN?.trim().replace(/\/$/, "");
      if (!origin) throw new Error("APP_ORIGIN fehlt.");
      await storeEmailLink(account.email, await hashSessionToken(token), new Date(Date.now() + 20 * 60 * 1000));
      await deliver(account.email, `${origin}/auth/confirm?token=${encodeURIComponent(token)}`);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Die Anmeldung ist gerade nicht möglich.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
