# Coolify

Der Dienst läuft als Dockerfile-App auf `coolify-host-0`.

| | |
| --- | --- |
| App | `cl3qb2c5nfazow6oqtaajteo` |
| Adresse | `https://visual-builder.coolify-host-0.omx.services` |
| Projekt | `visual-builder` (`mhyytuotdl5pqngh4savrraw`) |
| Environment | `production` (`0tabqo7797aznmmxcorkucgt`) |
| Datenbank | `visual-builder-postgres` (`zskdk8b9o3rftxgyngwde2k0`), intern, nicht öffentlich |
| Volume | `/var/lib/visual-builder` (`jycfam7plorkzjg00wwl5p2i`) |
| Health | `GET /api/health` prüft Datenbank, Schreibrecht auf dem Volume und einen Chromium-Start |

Der Container migriert beim Start und startet danach `node server.js`. Ohne `DATABASE_URL` oder `FILE_STORAGE_ROOT` antwortet `/api/health` mit 503 und nennt den fehlenden Punkt. Chromium liegt im Image unter `/usr/bin/chromium`.

Eine ungenutzte erste Datenbank `visual-builder-postgres-unused` (`cr4h9yjvadd8toh2kyc0kwis`) ist gestoppt. Sie kann in Coolify gelöscht werden. Dafür braucht der API-Token die Berechtigung `delete`; der vorhandene Token hat sie nicht.

## Postgres-Sicherung

Logischer Dump täglich um 03:15 Uhr, 14 Tage lokal, ohne S3. Konfiguration `ytqlxm6qhaigewwjv2jg6poz` an der Datenbank `zskdk8b9o3rftxgyngwde2k0`, Datenbank `visual_builder`. Die Datenbank bleibt dabei an.

Zusätzlich sichert Coolify das Datenverzeichnis `/var/lib/postgresql/data` (Volume `4rdwbdcvitxrro9gawhg4gzn`) täglich um 03:15 Uhr, 14 Tage, Zeitplan `d8wxirpacvcesvrebt2c0xab`. Der Dump ist die Sicherung, auf die man sich verlässt. Das Verzeichnis-Backup ist nur ein zweites Exemplar.

## Volume

Das Volume ist der Zwischenspeicher für Schriften, Logos und Vorschauen. Sobald Google Drive verbunden ist, führt das Drive. Die Datenbank protokolliert, das Volume kann neu aufgebaut werden, indem ein Kunde synchronisiert wird.

Coolify sichert es täglich um 03:45 Uhr, 14 Tage, ohne die App anzuhalten (Zeitplan `cltjx8d31peqoemfaz0py0uu`). Zusätzlich vom Server aus:

```bash
docker run --rm -v cl3qb2c5nfazow6oqtaajteo-visual-builder-files:/data alpine tar czf - /data > visual-builder-volume.tgz
```

## Privates Repo und Deploy-Key

Das Repo ist noch öffentlich. Coolify klont es ohne GitHub-App (`source_id` 0), sonst schlägt der nächste Deploy fehl.

Angelegt, aber noch nicht an die App gehängt:

- GitHub-Deploy-Key `coolify-visual-builder`, nur lesen, ID `170943062`
- Coolify-Schlüssel `visual-builder-deploy`, UUID `jrqq3inafzghvemn1cuoblnu`, Fingerabdruck `gqN6X8WaP75szVwNTVCe1XmAYhqBNqzYlWDFUa0MFww`

Die Coolify-API lehnt `private_key_uuid` an einer bestehenden öffentlichen App ab. Der Wechsel auf den Deploy-Key geht nur in der Oberfläche. Danach das Repo auf privat stellen. Solange der Wechsel nicht passiert ist, bleibt das Repo öffentlich, damit Deploys weiterlaufen.

Von Hand:

1. Schlüssel erzeugen, nur lokal, nicht ins Repo:

```bash
ssh-keygen -t ed25519 -f visual-builder-deploy -N "" -C "coolify-visual-builder"
```

2. Den öffentlichen Schlüssel bei GitHub als Deploy-Key eintragen, nur lesen:

```bash
gh repo deploy-key add visual-builder-deploy.pub --repo SEOOMfire/omfire-visual-builder --title coolify-visual-builder
```

3. In Coolify unter Keys den privaten Schlüssel anlegen, Name `visual-builder-deploy`.
4. Die App von „öffentliches Repository“ auf „Private Repository (Deploy Key)“ umstellen. Repository `git@github.com:SEOOMfire/omfire-visual-builder.git`, Branch `main`, Port `3000`, Dockerfile `/Dockerfile`. Dieselbe Domain behalten.
5. Erst danach das Repo auf privat stellen:

```bash
gh repo edit SEOOMfire/omfire-visual-builder --visibility private --accept-visibility-change-consequences
```

6. Einmal deployen. Schlägt das Klonen fehl, das Repo wieder öffentlich stellen, bis der Key sitzt. Die laufende App bleibt sonst auf dem letzten Image.

Healthcheck erst einschalten, wenn `/api/health` mit dem neuen Image 200 liefert. Pfad `/api/health`, Port `3000`, Methode GET, Code 200, Intervall 30 Sekunden, Timeout 20 Sekunden, Startperiode 60 Sekunden.
