# Übersetzung und Prüfung

In Coolify, App `cl3qb2c5nfazow6oqtaajteo`, als Runtime:

| Variable | Pflicht |
| --- | --- |
| `OPENROUTER_API_KEY` | ja |
| `VISUAL_BUILDER_OPENROUTER_MODEL` | nein |
| `VISUAL_BUILDER_OPENROUTER_FALLBACK_MODELS` | nein, kommagetrennt, höchstens zwei zusätzliche Namen |
| `OPENROUTER_HTTP_REFERER` | nein, sonst gilt `APP_ORIGIN` |
| `OPENROUTER_APP_TITLE` | nein |

Ohne Schlüssel starten Übersetzung und Prüfung nicht. Die Oberfläche und der MCP bleiben erreichbar und nennen den fehlenden Schlüssel, ohne einen Modellnamen zu zeigen.
