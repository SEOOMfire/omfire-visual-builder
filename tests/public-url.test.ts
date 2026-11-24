import assert from "node:assert/strict";
import test from "node:test";
import { publicBaseUrl } from "../src/modules/visual-builder/server/public-url";

test("signed links use the public https origin", () => {
  assert.equal(publicBaseUrl({ PUBLIC_BASE_URL: "https://visual-builder.coolify-host-0.omx.services/" }), "https://visual-builder.coolify-host-0.omx.services");
});

test("the bind address is rejected", () => {
  assert.throws(() => publicBaseUrl({ PUBLIC_BASE_URL: "http://0.0.0.0:3000" }), /öffentliche https-Adresse/);
  assert.throws(() => publicBaseUrl({}), /PUBLIC_BASE_URL fehlt/);
});
