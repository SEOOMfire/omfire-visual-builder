# CSV für Motiv-Stapel

Trennzeichen ist `;` oder `,`, je nachdem was in der Kopfzeile öfter vorkommt. UTF-8, mit oder ohne BOM.

Pflichtspalten: `kampagne`, `motiv`, `vorlage`, `headline`. Für Geräte-Kacheln zusätzlich `zielgruppe`, `einmalpreis`, `preis` und `datenmenge`.

`formate` mit `alle` meint alle sechs Formate: 1200x1200, 1200x628, 960x1200, 1x1, 9x16 und TikTok 9x16.

| Spalte | Bedeutung |
| --- | --- |
| kanal | `PMAX`, `Meta` oder `Tiktok` |
| quartal | zum Beispiel `Q4` |
| mmjj | Monat und Jahr, zum Beispiel `1126` |
| kampagne | Kurzname, zum Beispiel `BW` |
| zielgruppe | `Standard`, `Young`, `Hardware-Standard` oder `Hardware-Young` |
| motiv | Dateiname ohne Endung |
| vorlage | `young`, `kachel_person`, `kachel_geraet` oder `kachel_geraet_person` |
| headline | kurze Zeile, höchstens zwei |
| subline | Angebotstext |
| button | Text der Leiste, leer heißt die Standardleiste |
| stoerer | Zeilen mit `\|`, `**fett**` und `~~alt~~` |
| sprachen | zum Beispiel `de` |
| formate | `alle` oder eine Liste wie `1200x1200,1x1,9x16` |
| zusatz | optionales Namensstück, zum Beispiel `Go` |
| geraet_name | Gerätename, zum Beispiel `Samsung Galaxy A57` |
| energielabel | Klasse `A` bis `G` |
| einmalpreis | Einmalpreis, zum Beispiel `229 €` |
| einmalpreis_zusatz | Zusatz in der Lime-Box, zum Beispiel `+ mtl. 10 €` |
| preis | Monatspreis in der Pille |
| preis_zusatz | Zusatz zum Monatspreis, Standard `pro Monat` |
| preis_alt | Alter Einmalpreis für `statt`, nur wenn er höher ist als der neue |
| datenmenge | Datenvolumen, zum Beispiel `150 GB` |
| datenmenge_alt | durchgestrichener Altwert im Stern |
| stern_text | optionaler Text im Stern |
| deko | `bw_wellen`, `fruehling_blaetter` oder `keine` |

Die Black-Week-XLSX sind Schaltpläne und keine Vorlage für diese Datei. Drei Beispielzeilen liegen lokal in `export/otelo/vorlage-stapel.csv`.
