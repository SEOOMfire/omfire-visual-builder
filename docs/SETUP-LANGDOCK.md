# Langdock

1. In Langdock eine MCP-Integration anlegen.
2. URL: `https://visual-builder.coolify-host-0.omx.services/mcp`
3. Authentifizierung: API-Schlüssel. Im Coolify-Terminal des Containers: `npm run create-key -- --email … --name … --tenant otelo`. Den einmalig gedruckten Schlüssel als Bearer eintragen. `x-api-key` wird ebenfalls akzeptiert. Die Seite `/konto` ist aus.
4. `ping_image` muss ein kleines Bild im Chat zeigen und einen Link `/p/…` nennen.
5. `system_status` nennt, was noch fehlt.

Weitere Proben, sobald Drive und ein Kunde da sind:

1. `list_clients`
2. `brand_assets` für den Kunden
3. `compose_creative` mit Motiv, Vorlage und Headline
4. Hinweis vorlesen, dann `adjust_creative` (Störer nach links, nur Hochformat)
5. neue Vorschau
6. `save_creative` erst nach Rückfrage
7. `check_batch` auf `_eingang/black-friday.csv`
8. `run_batch` nur für Zeilen ohne Hinweis
