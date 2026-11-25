# Offene Punkte

- Neon wird nicht verwendet. Quelle ist der lokale Ordner `13_SEA`, nur gelesen.
- Kunden sind Zeilen im Mandanten der Person, die den API-Schlüssel besitzt. Standardmandant für otelo heißt `otelo`.
- Logo-Schutzzone 5 Prozent ist der Standard und muss vom Kunden bestätigt werden. Eine Mindestgröße in Millimetern steht im Styleguide nicht.
- `snow.svg` ist vorläufig ein Sticker. Der genaue Einsatz ist unklar.
- Die beiden Black-Week-XLSX sind Schaltpläne, keine Motiv-CSV.
- Pixelmaße sind nur an Stichproben gemessen. Der Katalog nennt die Rolle für jede Datei, die Maße nur dort, wo die Datei gelesen wurde.
- Vorlagen-Prozente sind aus drei Stills geschätzt, nicht aus den PSD-Ebenen.
- Die sechs otelo-Formate zeichnet der Renderer. Die drei alten Formate bleiben für vorhandene Entwürfe gültig.
- Die Oberfläche ist aus, solange `ENABLE_WEB_UI` beim Bauen nicht `true` ist. Der Wert wird beim Image-Bau gelesen, nicht erst zur Laufzeit.
- Google Drive bleibt unverbunden und ist kein Fehler. Der Export dafür bleibt im Code, kommt zuletzt.
- Das Repo bleibt öffentlich, bis der Deploy-Key in der Coolify-Oberfläche hängt.
- Drei Pixel-9a-Wallpapers, je rund 240 MB, liegen nicht auf dem Volume. Ein einzelner Upload würde das ganze Bild im Prozess halten.
- Die Frühlings-Blätter liegen als `bottom_right_spring_summer.ai` vor und werden als PNG auf das Volume gelegt. Ein Nachbau im Code gibt es nicht. Fehlt die Datei auf dem Volume, bleibt die Fläche leer.
- Beim Seitentausch der Schräg-Vorlagen liegt Orange über der steigenden Linie. Auf dem Quadrat reicht diese Fläche in die Headline; die Prüfung meldet das. Die Kachel-Vorlagen spiegeln Person, Kachel, Leiste und Deko, das Logo bleibt unten links.
- `SamsungA57_Logo.ai` ist ein PDF, aber kein Samsung-Schriftzug. Die gerenderte Fläche ist weiß, rechts sitzt nur der grüne Energiepfeil der Klasse A. `pdftocairo` ist auf dem Rechner nicht installiert; Quick Look hat denselben Pfeil gezeigt. Der Gerätename bleibt Text, die Klasse kommt aus `Class_Arrows_AG_A.svg`.
- Im Bestand gibt es keine Weihnachts- oder Winter-Deko. `snow.svg` ist ein Sticker, keine Kampagnenfläche. Für Dezember und Januar bleibt die Deko `keine`.
