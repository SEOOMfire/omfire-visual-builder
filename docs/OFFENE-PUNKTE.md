# Offene Punkte

Annahmen, mit denen der Dienst weitergebaut wird. Ändern, wenn eine andere Entscheidung gilt.

- Ein Drive-Kunde ist eine Zeile im Mandanten der angemeldeten Person, kein eigenes Login. Wer `visual-builder.read` auf diesem Mandanten hat, sieht alle Kunden dieses Mandanten.
- Die Benennung folgt dem Standard `{kunde}_{kampagne}_{motiv}_{format}_{sprache}_v{nn}`. `marke.json` darf sie später überschreiben; der Code liest das Feld, die Überschreibung ist noch nicht in jedem Export-Pfad aktiv.
- Überlappung von Stickern und Figuren ignoriert die Drehung und nimmt das ungedrehte Rechteck.
- Golden-Bilder werden nicht ins Repo gelegt. Die Toleranz steht in `docs/RENDER.md`. Schrift-Rasterung unterscheidet sich zwischen Rechnern.
- Das Repo bleibt öffentlich, bis die App in der Coolify-Oberfläche auf den Deploy-Key `jrqq3inafzghvemn1cuoblnu` umgestellt ist. Die API kann eine bestehende öffentliche App nicht umhängen.
- CSV-Stapel, Speichern und Drive-Sync melden den nächsten fehlenden Schritt, solange Drive oder ein synchronisierter Kunde fehlt. Sie legen dann nichts an.
