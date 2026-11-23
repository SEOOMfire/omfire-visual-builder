import postgres, { type Sql } from "postgres";

export type TenantDatabaseContext = Readonly<{
  userId: string;
  tenantId: string;
}>;

type QueryValue = string | number | boolean | null | Date | Record<string, unknown> | unknown[];

let connection: Sql | null = null;

function database(): Sql {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error("DATABASE_URL fehlt.");
  connection ??= postgres(url, { max: 10, ssl: url.includes("sslmode=require") ? "require" : false });
  return connection;
}

/**
 * Request context and the runtime role are set in the same transaction,
 * matching the Search OS contract the Visual Builder policies expect.
 */
export async function tenantQuery<Row extends Record<string, unknown>>(
  context: TenantDatabaseContext,
  statement: string,
  parameters: QueryValue[] = [],
): Promise<Row[]> {
  const rows = await database().begin(async (transaction) => {
    await transaction`select set_config('app.current_user_id', ${context.userId}, true), set_config('app.current_tenant_id', ${context.tenantId}, true)`;
    await transaction.unsafe("set local role app_runtime");
    return transaction.unsafe(statement, parameters as never[]);
  });
  return rows as unknown as Row[];
}

export async function runtimeQuery<Row extends Record<string, unknown>>(
  statement: string,
  parameters: QueryValue[] = [],
): Promise<Row[]> {
  const rows = await database().begin(async (transaction) => {
    await transaction.unsafe("set local role app_runtime");
    return transaction.unsafe(statement, parameters as never[]);
  });
  return rows as unknown as Row[];
}
