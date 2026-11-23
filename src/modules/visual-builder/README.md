# Visual-Builder

Erstellt Werbemittel in drei Formaten (1:1 1080×1080, 1.91:1 1200×628,
1:1.91 1080×1920) aus Motiv, zwei Textfenstern, Logo und Button. Texte werden
übersetzt und gegen die CI-Richtlinien des Mandanten geprüft; erst danach ist
der ZIP-Download offen. Fertige Stände landen im Archiv und lassen sich
wieder öffnen.

Übernommen aus dem eigenständigen Visual-Builder 3000 (`creative-fire-builder`),
funktional gleich, mit Search-OS-Anmeldung, -Rechten und -Speicher.

## Capabilities

| Capability | Erlaubt |
| --- | --- |
| `visual-builder.read` | Editor öffnen, Archiv ansehen, Konfiguration lesen |
| `visual-builder.create` | Übersetzen, CI-Prüfung, im Archiv speichern, Motiv-Format zuordnen |
| `visual-builder.upload` | Motive in den Drive-Ordner des Mandanten hochladen |
| `visual-builder.configure` | Logos, Buttons, Schriften, Sprachen, Richtlinien, sichere Zonen, Drive-Ordner |
| `visual-builder.delete` | Archiv-Einträge löschen |

OMfire-Rollen (Super-Admin, Admin, Lead) haben alles. `omfire_user`,
`client_admin` und `client_user` haben `read`, `create`, `upload`.
Das Modul ist für neue Mandanten aus (`defaultEnabled: false`) und intern
(`customerVisibleByDefault: false`).

## Freigabe des Downloads

Der Server schreibt jede CI-Prüfung als Datensatz (`visual_builder_guideline_checks`)
mit Nutzer und exakt geprüftem Text. Beim Speichern entscheidet der Trigger
`private.visual_builder_creative_guard`: nur eine eigene, bestandene Prüfung
genau dieses Textes macht den Eintrag `approved`, alles andere wird `draft`
(„Noch nicht geprüft“). `null` steht für übernommene Alt-Einträge; deren
Download bleibt offen. Die Prädikate liegen browser-sicher in `approval.ts`.

## Sichtbarkeit

Einträge, die OMfire anlegt, sind `audience = 'internal'` und bleiben für
Kunden auch nach dem Sichtbarschalten unsichtbar. Kunden sehen nur, was
Kunden selbst angelegt haben. Wörter wie KI, Prompt oder Modellnamen
erscheinen in keiner Oberfläche und keiner Fehlermeldung.

## Google Drive

Ein Service-Account (`GOOGLE_DRIVE_CLIENT_EMAIL`, `GOOGLE_DRIVE_PRIVATE_KEY`)
für alle Mandanten. Jeder Mandant verbindet eigene Ordner
(`visual_builder_libraries`); `assertInsideFolders` prüft vor jeder Auslieferung,
dass ein Bild in einem dieser Ordner liegt. Mit `GOOGLE_DRIVE_PARENT_FOLDER_ID`
(Ordner in einer geteilten Ablage) legt die Einstellung neue Mandanten-Ordner
selbst an. Motive werden same-origin über `/api/visual-builder/drive?image=`
geladen, damit das Canvas exportierbar bleibt.

## Speicher und Uploads

Logos, Buttons, Schriften, ZIPs und Vorschauen liegen in `file_objects`
(Vercel Blob bzw. lokal). Das Archiv-ZIP wird in Teilen ≤ 3 MB hochgeladen
(Anfragegrenze des Hostings) und serverseitig per SHA-256 geprüft. Reste
abgebrochener Uploads räumt das nächste Speichern desselben Nutzers weg –
ohne geplante Aufgabe.

## Schriften

Hausschriften lädt der Mandant in den Einstellungen hoch (OTF/TTF/WOFF/WOFF2);
der Editor lädt sie per `FontFace`. Ohne eigene Schrift gilt Arial.
