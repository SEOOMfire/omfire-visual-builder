import "server-only";

import { createHash } from "node:crypto";
import { runtimeQuery } from "../database/client";

export async function consumeDistributedRateLimit(input: {
  scope: string;
  identityParts: readonly string[];
  maxRequests: number;
  windowSeconds: number;
}): Promise<{ success: boolean; remaining: number; resetIn: number }> {
  const identity = createHash("sha256").update(input.identityParts.join("\0")).digest("hex");
  const rows = await runtimeQuery<{ allowed: boolean; remaining: number; retry_after_seconds: number }>(
    "select * from private.consume_rate_limit($1, $2, $3, $4)",
    [input.scope, identity, input.maxRequests, input.windowSeconds],
  );
  const row = rows[0];
  return {
    success: row?.allowed === true,
    remaining: row?.remaining ?? 0,
    resetIn: row?.retry_after_seconds ?? input.windowSeconds,
  };
}
