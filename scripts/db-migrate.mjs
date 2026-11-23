import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import postgres from "postgres";

const url = process.env.DATABASE_URL_UNPOOLED?.trim() || process.env.DATABASE_URL?.trim();
if (!url) throw new Error("DATABASE_URL_UNPOOLED oder DATABASE_URL fehlt.");

const sql = postgres(url, { max: 1, ssl: url.includes("sslmode=require") ? "require" : false });
try {
  const existing = await sql`select 1 from pg_roles where rolname = 'app_runtime'`;
  if (!existing.length) {
    const password = process.env.APP_RUNTIME_PASSWORD ?? "";
    if (password.length < 12) throw new Error("APP_RUNTIME_PASSWORD fehlt (mindestens 12 Zeichen), app_runtime gibt es noch nicht.");
    const literal = `'${password.replaceAll("'", "''")}'`;
    await sql.unsafe(`create role app_runtime login password ${literal} nosuperuser nocreatedb nocreaterole nobypassrls`);
  }
  await sql`create schema if not exists private`;
  await sql`create table if not exists private.schema_migrations (
    version text primary key,
    name text not null,
    checksum text not null,
    applied_at timestamptz not null default now()
  )`;
  const applied = await sql`select version, checksum from private.schema_migrations`;
  const known = new Map(applied.map((row) => [row.version, row.checksum]));
  const files = readdirSync("migrations").filter((name) => name.endsWith(".sql")).sort();
  for (const name of files) {
    const body = readFileSync(`migrations/${name}`, "utf8");
    const version = name.split("_", 1)[0];
    const checksum = createHash("sha256").update(body).digest("hex");
    const previous = known.get(version);
    if (previous && previous !== checksum) throw new Error(`Migration ${version} weicht von der schon angewendeten Fassung ab.`);
    if (previous) continue;
    await sql.begin(async (transaction) => {
      await transaction.unsafe(body);
      await transaction`insert into private.schema_migrations (version, name, checksum) values (${version}, ${name}, ${checksum})`;
    });
    console.log(`Angewendet ${version}.`);
  }
  console.log("Migrationen fertig.");
} finally {
  await sql.end();
}
