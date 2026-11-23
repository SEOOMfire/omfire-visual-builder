# Visual Builder

Eigenständiger Dienst für Werbemittel in drei Formaten. Er kommt aus dem Modul `visual-builder` des Search OS und läuft hier für sich: Oberfläche, später Renderer und MCP.

## Annahmen in dieser ersten Fassung

- Anmeldung nur für Personen mit einer OMfire-Rolle (`platform` oder `assigned_tenants`). Kundenrollen bleiben im Schema, damit die übernommenen Rechte-Tests weiter gelten, die Anmeldung legt sie nicht an.
- Magic-Link ist der vorgesehene Weg. Ein Passwort geht zusätzlich, wenn `AUTH_LOGIN_METHOD` das erlaubt. Google-Login ist noch nicht gebaut.
- Dateien liegen lokal unter `FILE_STORAGE_ROOT`. S3/MinIO ist als Wert vorgesehen, der Adapter kommt mit dem Coolify-Aufbau.
- Das erste Konto hängt an einem Mandanten. Weitere Mandanten und der Wechsel dazwischen folgen mit dem Import.

## Lokal starten

```bash
npm install
docker compose up -d
```

In `.env` (nicht committen) gehören mindestens `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `POSTGRES_PASSWORD`, `APP_RUNTIME_PASSWORD`, `APP_ORIGIN`, `ALLOWED_EMAIL_DOMAINS`, `FILE_STORAGE_PROVIDER=local` und `FILE_STORAGE_ROOT`.

```bash
npm run db:migrate
APP_BOOTSTRAP_EMAIL=… APP_BOOTSTRAP_PASSWORD=… npm run bootstrap
npm run dev
```

Die Oberfläche liegt unter `http://localhost:3000/visual-builder`.

## Tests

```bash
npm test
```

Die Rechte-Tests laufen gegen PGlite und wenden alle SQL-Dateien in `migrations/` an.

## Umgebung

Alle Namen stehen ohne Werte in `.env.example`. Secrets gehören nur in `.env` oder später in Coolify.
