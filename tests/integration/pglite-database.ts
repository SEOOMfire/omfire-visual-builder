import { readdir, readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

/**
 * A PGlite database with every repository migration, plus query functions with
 * the exact contract of src/platform/database/client.ts: request context and
 * the restricted runtime role are set inside the same transaction.
 */
export async function createMigratedDatabase() {
  const db = new PGlite();
  await db.exec(`
    create role app_runtime login nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
    create schema private;
    create table private.schema_migrations (
      version text primary key, name text not null, checksum text not null, applied_at timestamptz not null default now()
    );
  `);
  const directory = new URL("../../migrations/", import.meta.url);
  for (const name of (await readdir(directory)).filter((file) => file.endsWith(".sql")).sort()) {
    await db.exec(await readFile(new URL(name, directory), "utf8"));
  }

  async function tenantQuery<Row>(context: { userId: string; tenantId: string }, statement: string, parameters: unknown[] = []): Promise<Row[]> {
    return db.transaction(async (transaction) => {
      await transaction.query("select set_config('app.current_user_id', $1, true), set_config('app.current_tenant_id', $2, true)", [context.userId, context.tenantId]);
      await transaction.exec("set local role app_runtime");
      const result = await transaction.query<Row>(statement, parameters);
      return result.rows;
    });
  }

  async function runtimeQuery<Row>(statement: string, parameters: unknown[] = []): Promise<Row[]> {
    return db.transaction(async (transaction) => {
      await transaction.exec("set local role app_runtime");
      const result = await transaction.query<Row>(statement, parameters);
      return result.rows;
    });
  }

  return { db, tenantQuery, runtimeQuery };
}
