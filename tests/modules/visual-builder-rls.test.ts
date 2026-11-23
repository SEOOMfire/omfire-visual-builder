import assert from "node:assert/strict";
import test from "node:test";
import { createMigratedDatabase } from "../integration/pglite-database";

const tenant = "11000000-0000-0000-0000-000000000081";
const other = "11000000-0000-0000-0000-000000000082";
const staff = "21000000-0000-0000-0000-000000000081";
const customer = "21000000-0000-0000-0000-000000000082";
const customerUser = "21000000-0000-0000-0000-000000000083";

let database: Awaited<ReturnType<typeof createMigratedDatabase>>;

test.before(async () => {
  database = await createMigratedDatabase();
  await database.db.exec(`
    insert into users(id,email,display_name,status) values
      ('${staff}','vb-staff@example.test','Staff','active'),
      ('${customer}','vb-admin@example.test','Kunde','active'),
      ('${customerUser}','vb-user@example.test','Kundin','active');
    insert into tenants(id,slug,name) values('${tenant}','vb-customer','VB'),('${other}','vb-other','Other');
    insert into memberships(user_id,tenant_id,role_id,display_name,email) select '${staff}','${tenant}',id,'Staff','vb-staff@example.test' from roles where key='omfire_admin' and is_system;
    insert into memberships(user_id,tenant_id,role_id,display_name,email) select '${customer}','${tenant}',id,'Kunde','vb-admin@example.test' from roles where key='client_admin' and is_system;
    insert into memberships(user_id,tenant_id,role_id,display_name,email) select '${customerUser}','${tenant}',id,'Kundin','vb-user@example.test' from roles where key='client_user' and is_system;
    insert into tenant_modules(tenant_id,module_slug,enabled,customer_visible) values('${tenant}','visual-builder',true,false)
      on conflict(tenant_id,module_slug) do update set enabled=true,customer_visible=false;
  `);
});
test.after(async () => { await database?.db.close(); });

const as = (userId: string, tenantId = tenant) => <Row = Record<string, unknown>>(sql: string, params: unknown[] = []) =>
  database.tenantQuery<Row>({ userId, tenantId }, sql, params);

async function passedCheck(userId: string, text: string, approved = true) {
  const rows = await as(userId)<{ id: string }>(
    `insert into visual_builder_guideline_checks(tenant_id,user_id,source_text,approved) values($1,$2,$3,$4) returning id`,
    [tenant, userId, text, approved]);
  return rows[0]!.id;
}

async function saveCreative(userId: string, text: string, checkId: string | null, claimedStatus = "approved") {
  const rows = await as(userId)<{ id: string; guideline_status: string; audience: string }>(
    `insert into visual_builder_creatives(tenant_id,created_by,source_text,state,guideline_check_id,guideline_status,audience)
     values($1,$2,$3,'{"v":1}'::jsonb,$4,$5,'customer') returning id, guideline_status, audience`,
    [tenant, userId, text, checkId, claimedStatus]);
  return rows[0]!;
}

test("only the saver's own check of exactly this text approves or flags an archive entry", async () => {
  const check = await passedCheck(staff, "Sommer-Sale");
  const approved = await saveCreative(staff, "Sommer-Sale", check);
  assert.equal(approved.guideline_status, "approved");
  assert.equal(approved.audience, "internal", "OMfire entries are internal regardless of the request");

  const changedText = await saveCreative(staff, "Sommer-Sale!", check);
  assert.equal(changedText.guideline_status, "draft");

  const forged = await saveCreative(staff, "Ohne Prüfung", null, "approved");
  assert.equal(forged.guideline_status, "draft");

  const failed = await passedCheck(staff, "Mit Verstoß", false);
  assert.equal((await saveCreative(staff, "Mit Verstoß", failed)).guideline_status, "flagged", "a check with findings marks the entry as not signed off");
  assert.equal((await saveCreative(staff, "Mit Verstoß!", failed)).guideline_status, "draft", "a check of another text counts as unchecked");

  await database.db.query("update tenant_modules set customer_visible=true where tenant_id=$1 and module_slug='visual-builder'", [tenant]);
  const foreign = await saveCreative(customer, "Sommer-Sale", check);
  assert.equal(foreign.guideline_status, "draft", "another user's check never approves");
  await database.db.query("update tenant_modules set customer_visible=false where tenant_id=$1 and module_slug='visual-builder'", [tenant]);
});

test("customers see nothing while the module is internal and never see internal archive entries", async () => {
  assert.equal((await as(customer)("select * from visual_builder_creatives")).length, 0);
  assert.equal((await as(customer)("select * from visual_builder_languages")).length, 0);
  await assert.rejects(saveCreative(customer, "Kunde intern", null), /row-level security/);

  await database.db.query("update tenant_modules set customer_visible=true where tenant_id=$1 and module_slug='visual-builder'", [tenant]);
  const own = await saveCreative(customerUser, "Kundentext", null);
  assert.equal(own.audience, "customer");
  const visible = await as(customer)<{ audience: string }>("select audience from visual_builder_creatives");
  assert.ok(visible.length > 0);
  assert.ok(visible.every((row) => row.audience === "customer"), "internal entries stay hidden after the module becomes visible");
  const staffView = await as(staff)<{ audience: string }>("select audience from visual_builder_creatives");
  assert.ok(staffView.some((row) => row.audience === "internal") && staffView.some((row) => row.audience === "customer"));
  await database.db.query("update tenant_modules set customer_visible=false where tenant_id=$1 and module_slug='visual-builder'", [tenant]);
});

test("guideline checks belong to their author and cannot be written for someone else", async () => {
  await database.db.query("update tenant_modules set customer_visible=true where tenant_id=$1 and module_slug='visual-builder'", [tenant]);
  await assert.rejects(as(customerUser)(
    `insert into visual_builder_guideline_checks(tenant_id,user_id,source_text,approved) values($1,$2,'x',true)`, [tenant, staff]), /row-level security/);
  const mine = await passedCheck(customerUser, "Eigener Text");
  const seenByOther = await as(customer)("select id from visual_builder_guideline_checks where id=$1", [mine]);
  assert.equal(seenByOther.length, 0);
  await assert.rejects(as(customerUser)("update visual_builder_guideline_checks set approved=true where id=$1", [mine]), /permission denied/);
  await database.db.query("update tenant_modules set customer_visible=false where tenant_id=$1 and module_slug='visual-builder'", [tenant]);
});

test("configuration and deletion need their capabilities; tenants stay fenced", async () => {
  await database.db.query("update tenant_modules set customer_visible=true where tenant_id=$1 and module_slug='visual-builder'", [tenant]);
  await as(staff)(`insert into visual_builder_languages(tenant_id,code,label) values($1,'de','Deutsch')`, [tenant]);
  await assert.rejects(as(customer)(`insert into visual_builder_languages(tenant_id,code,label) values($1,'fr','Französisch')`, [tenant]), /row-level security/);
  await assert.rejects(as(customer)(`insert into visual_builder_guidelines(tenant_id,content_text,updated_by) values($1,'x',$2)`, [tenant, customer]), /row-level security/);
  assert.equal((await as(customer)("select code from visual_builder_languages")).length, 1, "customers read configuration");

  const entry = await saveCreative(customerUser, "Zu löschen", null);
  const removed = await as(customer)("delete from visual_builder_creatives where id=$1 returning id", [entry.id]);
  assert.equal(removed.length, 0, "client admins cannot delete without the delete capability");
  const byStaff = await as(staff)("delete from visual_builder_creatives where id=$1 returning id", [entry.id]);
  assert.equal(byStaff.length, 1);
  assert.equal((await as(staff)("delete from visual_builder_creatives where id=$1 returning id", [entry.id])).length, 0, "a second delete is a no-op");

  assert.equal((await as(staff, other)("select * from visual_builder_languages")).length, 0);
  await assert.rejects(as(staff, other)(`insert into visual_builder_languages(tenant_id,code,label) values($1,'en','Englisch')`, [tenant]), /row-level security/);

  await database.db.query("update tenant_modules set enabled=false where tenant_id=$1 and module_slug='visual-builder'", [tenant]);
  assert.equal((await as(staff)("select * from visual_builder_languages")).length, 0, "a disabled module exposes nothing");
  await database.db.query("update tenant_modules set enabled=true, customer_visible=false where tenant_id=$1 and module_slug='visual-builder'", [tenant]);
});
