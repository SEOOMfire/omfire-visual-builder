# Was noch zu tun ist

Nicht nur Drive und OpenRouter. Diese Punkte sind im Code vorbereitet und noch nicht zu Ende geführt.

## Von dir

1. In Coolify die App von „öffentliches Repository“ auf den Deploy-Key `visual-builder-deploy` umstellen. Danach das Repo auf privat stellen. Schritte in `docs/SETUP-COOLIFY.md`.
2. Google Drive verbinden. Schritte in `docs/SETUP-DRIVE.md`.
3. `OPENROUTER_API_KEY` eintragen. Schritte in `docs/SETUP-OPENROUTER.md`.
4. Login-Variablen setzen (`ALLOWED_EMAIL_DOMAINS`, Resend) und das erste Konto mit `npm run bootstrap` anlegen, falls das noch nicht geschehen ist.
5. Unter `https://visual-builder.coolify-host-0.omx.services/konto` einen API-Schlüssel erzeugen und in Langdock eintragen. Schritte in `docs/SETUP-LANGDOCK.md`.

## Im Dienst, noch nicht fertig

- `sync_client` schreibt die Dateien aus `_system` noch nicht in die Tabellen. Schema und Prüfung für `marke.json` und Vorlagen sind da.
- `compose_creative`, `adjust_creative`, `save_creative` und die CSV-Aufträge antworten mit dem nächsten fehlenden Schritt, sie erzeugen noch keine Dateien.
- `init_client` legt die Ordner im Drive noch nicht an.
- otelo ist nicht exportiert. Dafür fehlt der lesende Zugriff auf Neon in diesem Lauf. STOPP A ist deshalb noch nicht erreicht.
- Die Profilseite zeigt den neuen Schlüssel, listet bestehende Schlüssel aber noch nicht zum Widerrufen.
