# Vorlagen

Eine Vorlage ist eine JSON-Datei unter `_system/vorlagen/`. Das Schema ist `docs/schemas/vorlage.schema.json`.

Der Name ist klein und mit Bindestrichen, zum Beispiel `hero-rechts`. Die Beschreibung sagt, wofür die Vorlage gedacht ist. Je Format gibt es genau zwei Textkästen als Platzhalter, dazu optional Logo, Button, Figur, Störer und Sticker. Feste Werbetexte gehören nicht in die Vorlage.

Ein Entwurf aus dem Editor soll sich später als solche Datei herunterladen lassen, damit man die Vorlage im Editor baut und ins Drive legt. Dieser Download ist noch nicht in der Oberfläche.

## otelo im Renderer

Vier Vorlagen, jeweils in den sechs Formaten: `tarif`, `product`, `product_person`, `young`. `standard` meint `tarif`, `hardware` meint `product`. Eine eigene Black-Week-Vorlage gibt es nicht. Die Black-Week-Stills unterscheiden sich über Texte und Störer, nicht über ein weiteres Layout.

Die Schräge steigt durchgehend von links unten nach rechts oben. Orange liegt bei etwa einem Drittel der Fläche und nie über der Hälfte. Im kurzen Querformat liegt der Winkel dafür etwas unter 25 Grad. `orange` ist `links` oder `rechts` und lässt sich mit `adjust_creative` ändern. `headline_variante` ist `direkt` (Lime auf Schwarz) oder `box` (schwarze Treppen-Box mit weißer Kontur).

Pflichttext im Motiv, abgeleitet aus Stills unter `Werbemittel/` (PMax 1200×1200 Standard Classic, PMax 1200×628 S26, Meta 1:1 Standard Classic, TikTok 9:16 Standard Classic). In keiner dieser Dateien steht der lange Rechtssatz. Er ist deshalb bei PMax, Meta und TikTok optional und wird nur gezeichnet, wenn das Feld gefüllt ist.

Ein Preis mit `¹` oder `*` ohne Pflichttext lässt sich nicht speichern. Das ist eine Messung, keine Bildmeinung.
