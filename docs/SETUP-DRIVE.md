# Google Drive

1. In der Google Cloud ein Projekt öffnen und die Drive API aktivieren.
2. Einen Dienstaccount anlegen und einen JSON-Schlüssel erzeugen.
3. Eine geteilte Ablage „Visual Builder“ anlegen. Den Dienstaccount als Inhaltsmanager auf diese Ablage setzen, nicht nur auf einen einzelnen Ordner.
4. Den Ordner „Visual Builder“ anlegen, falls die Ablage selbst nicht dieser Ordner ist. Seine ID ist der lange Teil der Ordner-URL.
5. In Coolify, App `cl3qb2c5nfazow6oqtaajteo`, nur als Runtime:

| Variable | Wert |
| --- | --- |
| `GOOGLE_DRIVE_CLIENT_EMAIL` | `client_email` aus dem JSON |
| `GOOGLE_DRIVE_PRIVATE_KEY` | `private_key` aus dem JSON, die Zeilenumbrüche als `\n` |
| `GOOGLE_DRIVE_ROOT_FOLDER_ID` | ID des Ordners „Visual Builder“ |

6. App neu starten. In Langdock `system_status` aufrufen. Danach `init_client` für einen Kunden, sobald das Werkzeug die Ordner anlegt.

Ohne diese Werte startet der Dienst normal und sagt, dass Drive fehlt.
