const MUTATION_REJECTED_MESSAGE = "Anfrage nicht erlaubt.";

/**
 * Reject browser mutations that originate outside the origin serving the
 * request. Missing browser metadata remains allowed for trusted server-to-
 * server callers; browsers send Origin and Sec-Fetch-Site for these methods.
 */
export function rejectCrossSiteMutation(request: Request): Response | null {
  const fetchSite = request.headers.get("sec-fetch-site")?.trim().toLowerCase();
  if (fetchSite === "cross-site") {
    return Response.json({ error: MUTATION_REJECTED_MESSAGE }, { status: 403 });
  }

  const originHeader = request.headers.get("origin")?.trim();
  if (!originHeader) return null;

  // With "Referrer-Policy: no-referrer" (vercel.json) browsers send
  // "Origin: null" for plain form posts such as sign-out. Then only the
  // browser-set Sec-Fetch-Site, which page scripts cannot forge, may vouch.
  if (originHeader === "null") {
    return fetchSite === "same-origin" ? null : Response.json({ error: MUTATION_REJECTED_MESSAGE }, { status: 403 });
  }

  try {
    const suppliedOrigin = new URL(originHeader).origin;
    const requestOrigin = new URL(request.url).origin;
    if (suppliedOrigin === requestOrigin) return null;
  } catch {
    // Malformed and opaque origins fail closed.
  }

  return Response.json({ error: MUTATION_REJECTED_MESSAGE }, { status: 403 });
}
