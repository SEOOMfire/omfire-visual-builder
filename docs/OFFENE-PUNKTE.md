# Offene Punkte

- Neon wird nicht verwendet. Quelle ist der lokale Ordner `13_SEA`, nur gelesen.
- Kunden sind Zeilen im Mandanten der Person, die den API-Schlüssel besitzt. Standardmandant für otelo heißt `otelo`.
- Logo-Schutzzone und Mindestgröße stehen im gelesenen Styleguide nicht in Millimetern. Bis dahin 5 Prozent Rand je Format.
- `snow.svg` ist vorläufig ein Sticker. Der genaue Einsatz ist unklar.
- Die beiden Black-Week-XLSX sind Schaltpläne, keine Motiv-CSV.
- Pixelmaße sind nur an Stichproben gemessen. Der Katalog nennt die Rolle für jede Datei, die Maße nur dort, wo die Datei gelesen wurde.
- Vorlagen-Prozente sind aus drei Stills geschätzt, nicht aus den PSD-Ebenen.
- Der Renderer kennt die sechs otelo-Formate noch nicht als eigene Zeichenflächen. Die drei alten Formate bleiben gültig.
- Die Oberfläche ist aus, solange `ENABLE_WEB_UI` beim Bauen nicht `true` ist. Der Wert wird beim Image-Bau gelesen, nicht erst zur Laufzeit.
- Google Drive bleibt unverbunden und ist kein Fehler. Der Export dafür bleibt im Code, kommt zuletzt.
- Das Repo bleibt öffentlich, bis der Deploy-Key in der Coolify-Oberfläche hängt.
