/** Public origin for signed links. Never the bind address of the incoming request. */
export function publicBaseUrl(source?: { PUBLIC_BASE_URL?: string }): string {
  const env = source ?? process.env;
  const value = (env.PUBLIC_BASE_URL ?? "").trim().replace(/\/$/, "");
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("PUBLIC_BASE_URL fehlt. In Coolify nur zur Laufzeit setzen, zum Beispiel https://visual-builder.coolify-host-0.omx.services");
  }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || host === "0.0.0.0" || host === "127.0.0.1" || host === "localhost") {
    throw new Error("PUBLIC_BASE_URL muss die öffentliche https-Adresse sein, nicht die Bind-Adresse.");
  }
  return url.origin;
}

export function previewUrl(token: string): string {
  return `${publicBaseUrl()}/p/${token}`;
}
