# Marke

`marke.json` liegt im Kundenordner unter `_system/`. Das Schema ist `docs/schemas/marke.schema.json`.

Schriften verweisen auf einen Dateinamen in `schriften/`, mit Gewicht und Stil. Die Palette nennt Farben mit Namen und Hex-Wert. Sprachen haben Code, Bezeichnung und ob sie aktiv sind. Sichere Zonen gibt es für `1080x1080`, `1200x628` und `1080x1920`.

`benennung` darf leer sein. Dann gilt der Standard aus `docs/RESTARBEITEN.md` und der Benennung im Dienst: Ordner `ausgabe/{kampagne}/{jjjj-mm}`, Datei `{kunde}_{kampagne}_{motiv}_{format}_{sprache}_v{nn}.png`.

Logos, Buttons und Störer werden hier beschrieben und nicht in der Oberfläche geändert.
