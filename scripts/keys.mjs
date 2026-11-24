import { createHash, pbkdf2Sync, randomBytes } from "node:crypto";
import postgres from "postgres";

const url = process.env.DATABASE_URL_UNPOOLED?.trim() || process.env.DATABASE_URL?.trim();
if (!url) throw new Error("DATABASE_URL fehlt.");

function arg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : "";
}

function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(password, salt, 310000, 32, "sha256");
  return `pbkdf2_sha256$310000$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

const sql = postgres(url, { max: 1, ssl: url.includes("sslmode=require") ? "require" : false });
const action = process.argv[2];

try {
  if (action === "create") {
    const email = arg("email").trim().toLowerCase();
    const name = arg("name").trim() || "OMfire";
    const tenantSlug = arg("tenant").trim() || "otelo";
    if (!email.includes("@")) throw new Error("Bitte --email angeben.");
    const passwordHash = hashPassword(randomBytes(18).toString("base64url"));
    const tenant = await sql`
      insert into public.tenants (slug, name) values (${tenantSlug}, ${tenantSlug})
      on conflict (slug) do update set name = excluded.name returning id`;
    const user = await sql`
      insert into public.users (email, display_name, password_hash, status)
      values (${email}, ${name}, ${passwordHash}, 'active')
      on conflict (email) do update set display_name = excluded.display_name, status = 'active'
      returning id`;
    await sql`
      insert into public.memberships (user_id, tenant_id, role_id, display_name, email)
      select ${user[0].id}, ${tenant[0].id}, r.id, ${name}, ${email}
        from public.roles r where r.key = 'omfire_admin' and r.is_system
      on conflict (user_id, tenant_id) do update set role_id = excluded.role_id, is_active = true`;
    await sql`
      insert into public.tenant_modules (tenant_id, module_slug, enabled, customer_visible)
      values (${tenant[0].id}, 'visual-builder', true, false)
      on conflict (tenant_id, module_slug) do update set enabled = true`;
    const secret = `vb_${randomBytes(24).toString("base64url")}`;
    const prefix = secret.slice(0, 12);
    const tokenHash = createHash("sha256").update(secret).digest("hex");
    const token = await sql`
      insert into public.api_tokens (tenant_id, user_id, name, prefix, token_hash)
      values (${tenant[0].id}, ${user[0].id}, ${name}, ${prefix}, ${tokenHash})
      returning id`;
    console.log(`Schlüssel ${token[0].id} für ${email} im Mandanten ${tenantSlug}.`);
    console.log("Einmalig, nicht wieder abrufbar:");
    console.log(secret);
  } else if (action === "list") {
    const rows = await sql`
      select t.id, t.name, t.prefix, u.email, t.revoked_at
        from public.api_tokens t join public.users u on u.id = t.user_id
       order by t.created_at desc`;
    for (const row of rows) console.log(`${row.id}\t${row.prefix}\t${row.email}\t${row.name}\t${row.revoked_at ? "widerrufen" : "aktiv"}`);
  } else if (action === "revoke") {
    const id = arg("id");
    if (!id) throw new Error("Bitte --id angeben.");
    const rows = await sql`update public.api_tokens set revoked_at = now() where id = ${id} and revoked_at is null returning id`;
    console.log(rows.length ? `Widerrufen ${id}.` : `Kein aktiver Schlüssel ${id}.`);
  } else {
    throw new Error("Befehl: create, list oder revoke.");
  }
} finally {
  await sql.end();
}
