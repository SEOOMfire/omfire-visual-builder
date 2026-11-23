import assert from "node:assert/strict";
import test from "node:test";
import { createMigratedDatabase } from "../integration/pglite-database";

test("an archive insert without a user is rejected", async () => {
  const database = await createMigratedDatabase();
  try {
    const tenant = "11000000-0000-0000-0000-000000000091";
    await database.db.exec(`insert into tenants(id, slug, name) values('${tenant}', 'guard', 'Guard')`);
    await assert.rejects(
      database.db.query(
        `insert into visual_builder_creatives(tenant_id, source_text, guideline_status, audience)
         values($1, 'Ohne Person', 'approved', 'customer')`,
        [tenant],
      ),
      /angemeldete Person|42501/,
    );
  } finally {
    await database.db.close();
  }
});
