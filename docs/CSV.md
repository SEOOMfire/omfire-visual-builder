# CSV

Die Datei liegt unter `{kunde}/_eingang/`. Trennzeichen ist `;` oder `,`, je nachdem was in der Kopfzeile öfter vorkommt. UTF-8, mit oder ohne BOM.

Pflichtspalten: `kampagne`, `motiv`, `vorlage`, `headline`.

Weitere Spalten: `subline`, `button`, `stoerer`, `sprachen`, `formate`, `name_zusatz`, optional `logo`, `button` als Vorlagenname und `stoerer_vorlage`.

`stoerer` trennt Zeilen mit `|`. `**fett**` und `~~alter Preis~~` bleiben wie im Editor. Leer heißt ohne Störer.

`sprachen` zum Beispiel `de,tr`. `formate` ist `alle` oder eine Liste wie `1080x1080,1200x628`.

Ein Beispiel liegt in `docs/beispiel.csv`.
