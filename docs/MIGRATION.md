# Übernahme aus dem Search OS

Quelle war das Arbeitsverzeichnis `omfire-search-os-2026`, nur gelesen. Das Quell-Repo und die Produktionsdatenbank sind unverändert. Ein zweiter Klon war nicht nötig.

## Unverändert kopiert

- `src/modules/visual-builder/` einschließlich Editor, `render.ts`, Drive-Client und Dienste
- `app/api/visual-builder/` (dieselben vier Routen)
- die fünf Search-OS-Migrationen `202611041400` bis `202611061300`
- `tests/modules/visual-builder*.test.ts` und `tests/integration/pglite-database.ts`
- `src/components/Feedback.tsx`
- `src/platform/http/mutation-origin.ts`
- `src/platform/auth/passwords.ts`
- `design-system/components/Modal.tsx` (der Upload-Dialog hängt daran)

Die Moduldateien behalten ihre Importpfade. Die Plattform darunter ist neu und kleiner.

## Ersetzt

| Search OS | Hier |
| --- | --- |
| vinext/Vite, ganzes Plattformschema | Next.js, `migrations/000_foundation.sql` |
| Session-Cookie des Search OS, Magic-Link über die Plattform | eigenes Cookie `vb-session`, Magic-Link oder Passwort, nur OMfire-Rollen |
| `tenantQuery` über Neon-Serverless | dieselbe Session (`app.current_user_id`, `app.current_tenant_id`, Rolle `app_runtime`) über `postgres` |
| OpenRouter mit Usage-Ledger, Fallback-Kette und Ausgabenbremse | ein schlanker Aufruf, Modellname bleibt in der Umgebung, Antworten an die Oberfläche nennen ihn nicht |
| verteiltes Rate-Limit der Plattform | `private.consume_rate_limit`, weiter 120 Aufrufe je Person und Stunde |
| `logBackgroundError` mit Fehlerakte | eine Zeile ohne Schlüssel und ohne Auftragstext |
| Vercel Blob | lokaler Ordner, SHA-256 und `file_objects` bleiben |
| Modulregistrierung des Search OS | `requireEnabledModule` liest nur `tenant_modules` |

## Neu gegenüber dem Search OS

`migrations/202611240900_visual_builder_guard_user.sql` lässt einen Archiv-Insert ohne Nutzer-ID nicht mehr durch. Der kopierte Trigger hatte die Zeile in dem Fall unverändert übernommen.

## Bewusst nicht übernommen

Shell, Freigabe-Modul, Work, übrige Search-OS-Migrationen, Vercel-Blob-Client, Usage-Ledger, Kunden-Anmeldung.

## Offen

- S3-Adapter
- Renderer, Vorlagen, API-Schlüssel, MCP, Drive-Export
- vollständige Oberfläche des Search OS (Abstände und Schrift der Shell sind hier nur angeglichen)
- welche Login-Variante in Betrieb gilt
