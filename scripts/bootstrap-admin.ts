import postgres from "postgres";
import { hashPassword } from "../src/platform/auth/passwords";

const url = process.env.DATABASE_URL_UNPOOLED?.trim() || process.env.DATABASE_URL?.trim();
const email = process.env.APP_BOOTSTRAP_EMAIL?.trim().toLowerCase() ?? "";
const password = process.env.APP_BOOTSTRAP_PASSWORD ?? "";
const name = process.env.APP_BOOTSTRAP_NAME?.trim() || "OMfire";
const tenantSlug = process.env.APP_BOOTSTRAP_TENANT_SLUG?.trim() || "omfire";
const tenantName = process.env.APP_BOOTSTRAP_TENANT_NAME?.trim() || "OMfire";

if (!url) throw new Error("DATABASE_URL_UNPOOLED oder DATABASE_URL fehlt.");
if (!email.includes("@") || password.length < 12) {
  throw new Error("APP_BOOTSTRAP_EMAIL und APP_BOOTSTRAP_PASSWORD (mindestens 12 Zeichen) setzen.");
}

const sql = postgres(url, { max: 1, ssl: url.includes("sslmode=require") ? "require" : false });
try {
  const passwordHash = await hashPassword(password);
  const tenant = await (sql`
    insert into public.tenants (slug, name)
    values (${tenantSlug}, ${tenantName})
    on conflict (slug) do update set name = excluded.name
    returning id` as unknown as Promise<Array<{ id: string }>>);
  const user = await (sql`
    insert into public.users (email, display_name, password_hash, status)
    values (${email}, ${name}, ${passwordHash}, 'active')
    on conflict (email) do update set display_name = excluded.display_name, password_hash = excluded.password_hash, status = 'active'
    returning id` as unknown as Promise<Array<{ id: string }>>);
  await sql`
    insert into public.memberships (user_id, tenant_id, role_id, display_name, email)
    select ${user[0]!.id}, ${tenant[0]!.id}, r.id, ${name}, ${email}
      from public.roles r
     where r.key = 'omfire_admin' and r.is_system
    on conflict (user_id, tenant_id) do update set role_id = excluded.role_id, is_active = true`;
  await sql`
    insert into public.tenant_modules (tenant_id, module_slug, enabled, customer_visible)
    values (${tenant[0]!.id}, 'visual-builder', true, false)
    on conflict (tenant_id, module_slug) do update set enabled = true`;
  console.log(`Konto ${email} ist Admin im Mandanten ${tenantSlug}.`);
} finally {
  await sql.end();
}
