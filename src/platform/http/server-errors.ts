import "server-only";

import { NextResponse } from "next/server";
import { logBackgroundError } from "../observability/background-error";

export const INTERNAL_ERROR_MESSAGE = "Die Anfrage konnte nicht verarbeitet werden.";

export function internalApiError(request: Request, error: unknown, area: string, message = INTERNAL_ERROR_MESSAGE) {
  const correlationId = crypto.randomUUID();
  let path = "unknown";
  try {
    path = new URL(request.url).pathname;
  } catch {
    path = "unknown";
  }
  logBackgroundError(error, area);
  console.error(JSON.stringify({ correlationId, area, method: request.method, path }));
  return NextResponse.json(
    { error: message, error_code: "internal_error", correlation_id: correlationId },
    { status: 500, headers: { "X-Correlation-ID": correlationId } },
  );
}
