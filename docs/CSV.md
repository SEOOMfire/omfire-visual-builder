# CSV für Motiv-Stapel

Trennzeichen ist `;` oder `,`, je nachdem was in der Kopfzeile öfter vorkommt. UTF-8, mit oder ohne BOM.

Pflichtspalten: `kanal`, `kampagne`, `zielgruppe`, `motiv`, `vorlage`, `headline`.

| Spalte | Bedeutung |
| --- | --- |
| kanal | `PMAX`, `Meta` oder `Tiktok` |
| quartal | zum Beispiel `Q4` |
| mmjj | Monat und Jahr, zum Beispiel `1126` |
| kampagne | Kurzname, zum Beispiel `BW` |
| zielgruppe | `Standard`, `Young`, `Hardware-Standard` oder `Hardware-Young` |
| motiv | Dateiname ohne Endung |
| vorlage | `young`, `standard` oder `hardware` |
| headline | kurze Zeile, höchstens zwei |
| subline | Angebotstext |
| button | Text der Leiste, leer heißt die Standardleiste |
| stoerer | Zeilen mit `\|`, `**fett**` und `~~alt~~` |
| energielabel | Klasse `A` bis `G`, leer heißt keins |
| sprachen | zum Beispiel `de` |
| formate | `alle` oder eine Liste wie `1200x1200,1x1,9x16` |
| zusatz | optionales Namensstück, zum Beispiel `mitBatch` |

Die Black-Week-XLSX sind Schaltpläne und keine Vorlage für diese Datei. Drei Beispielzeilen liegen lokal in `export/otelo/vorlage-stapel.csv`.
