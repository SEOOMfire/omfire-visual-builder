import assert from "node:assert/strict";
import test from "node:test";
import { healthReport } from "../src/platform/health/checks";

test("health is ok only when database, volume and chromium are ok", () => {
  const ok = healthReport({
    database: { ok: true, detail: "erreichbar" },
    volume: { ok: true, detail: "beschreibbar" },
    chromium: { ok: true, detail: "startbar" },
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.database, "erreichbar");

  const missing = healthReport({
    database: { ok: false, detail: "DATABASE_URL fehlt." },
    volume: { ok: true, detail: "beschreibbar" },
    chromium: { ok: false, detail: "Chromium fehlt im Image." },
  });
  assert.equal(missing.ok, false);
  assert.match(missing.database, /DATABASE_URL/);
  assert.match(missing.chromium, /fehlt/);
});
