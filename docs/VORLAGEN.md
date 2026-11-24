# Vorlagen

Eine Vorlage ist eine JSON-Datei unter `_system/vorlagen/`. Das Schema ist `docs/schemas/vorlage.schema.json`.

Der Name ist klein und mit Bindestrichen, zum Beispiel `hero-rechts`. Die Beschreibung sagt, wofür die Vorlage gedacht ist. Je Format gibt es genau zwei Textkästen als Platzhalter, dazu optional Logo, Button, Figur, Störer und Sticker. Feste Werbetexte gehören nicht in die Vorlage.

Ein Entwurf aus dem Editor soll sich später als solche Datei herunterladen lassen, damit man die Vorlage im Editor baut und ins Drive legt. Dieser Download ist noch nicht in der Oberfläche.

## otelo im Renderer

Vier Vorlagen, jeweils in den sechs Formaten: `tarif`, `product`, `product_person`, `young`. `standard` meint `tarif`, `hardware` meint `product`. Eine eigene Black-Week-Vorlage gibt es nicht. Die Black-Week-Stills unterscheiden sich über Texte und Störer, nicht über ein weiteres Layout.

Die Schräge steigt durchgehend von links unten nach rechts oben. Orange liegt bei etwa einem Drittel der Fläche, ersatzweise bei der Hälfte. `orange` ist `links` oder `rechts` und lässt sich mit `adjust_creative` ändern. `headline_variante` ist `direkt` (Lime auf Schwarz) oder `box` (schwarze Treppen-Box mit weißer Kontur).

Pflichttext im Motiv, abgeleitet aus den Stills und den Styleguide-Bannern:

| Format | Pflichttext im Motiv |
| --- | --- |
| PMax 1200×1200, 1200×628, 960×1200 | ja, wie die Banner im Styleguide |
| Meta 1:1 und 9:16 | nein, die Social-Stills tragen den langen Rechtssatz nicht |
| TikTok 9:16 | nein |

Ein Preis mit `¹` oder `*` ohne Pflichttext lässt sich nicht speichern. Fehlt das Feld, gilt der Standardsatz.
