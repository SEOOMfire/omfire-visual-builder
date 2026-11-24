# Renderer

Die interne Seite `/internal/render` lädt das unveränderte `render.ts` und zeichnet einen `CreativeState`. Playwright hält ein Chromium warm. Gleichzeitig laufen höchstens `RENDER_CONCURRENCY` Seiten, Standard 2.

Von außen antworten `/internal` und `/api/internal` mit 404. Im Container gilt der Kopf `x-render-token`, abgeleitet aus `APP_RUNTIME_PASSWORD`. Fehlt das Passwort, startet der Dienst trotzdem und die Vorschau sagt, was fehlt.

Je Format entsteht ein PNG in voller Größe. Der Kontaktbogen legt die Formate nebeneinander in ein JPEG, längste Kante etwa 1400 Pixel, und senkt die Qualität, bis die Datei unter 300 KB liegt. Unter jedem Format steht die Pixelgröße.

## Hinweise

Gemessen wird die echte Textfläche (die gemalten Buchstaben, nicht der Rahmen). Störer, Logo, Button, Sticker und Figur kommen aus denselben Platzierungsfunktionen wie der Editor. Eine Figur darf Sticker überdecken, das ist kein Hinweis. Überlappung, Verlassen der sicheren Zone, starke Verkleinerung unter 75 Prozent der gewünschten Schriftgröße und Abschneiden (gemalte Größe höchstens 6 Pixel) sind Hinweise. Jeder Hinweis nennt Format, Elemente, Art und einen deutschen Satz.

Drehung von Stickern und Figuren geht in die Fläche als ungedrehtes Rechteck ein. Das ist eine Annäherung an die sichtbare Fläche.

## Golden Images

Dieselbe `drawCanvas`-Funktion zeichnet Editor und Server. Ein Vergleich zweier Läufe muss deckungsgleich sein. Gegen ein gespeichertes Editor-Bild gilt: höchstens 2 Prozent der Pixel dürfen sich in einem Kanal um mehr als 16 von 255 unterscheiden. Grund sind Schrift-Rasterung und das Betriebssystem, nicht ein anderes Layout. Die automatischen Tests prüfen die Hinweislogik ohne Browser, weil die Golden-Bilder sonst an die Schrift des Rechners gebunden wären.
