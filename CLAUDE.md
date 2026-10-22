# Jet Lag Hide & Seek – Wien-Version

Fork von [taibeled/JetLagHideAndSeek](https://github.com/taibeled/JetLagHideAndSeek) (MIT-Lizenz), den wir für Spiele in Wien anpassen.
Live-Version: https://danumi.github.io/JetLagHideAndSeek/

## Zusammenarbeit

- Der Nutzer spricht Deutsch: Antworten und Erklärungen auf Deutsch. Code, Kommentare und Commit-Messages auf Englisch.
- Die App bleibt durchgängig auf Englisch (wie das Spiel selbst): alle Texte, Knöpfe, Dialoge und Meldungen. Keine deutschen Texte in die App einbauen. Ausnahmen: Namen aus OSM (Stationsnamen wie auf dem Schild) und die Wiener Verwaltungsbegriffe Bundesland, Gemeindebezirk und Katastralgemeinde (Daniels Wunsch, Etappe 9; `ADMIN_LEVEL_NAMES` in `deck.ts`). Nicht „korrigieren".
- Der Nutzer ist kein Entwickler. Änderungen in Alltagssprache erklären (was ändert sich im Spiel?), nicht im Code-Jargon.
- Die Datei LICENSE (MIT, taibeled) bleibt im Repo, das verlangt die Lizenz. Sichtbare Credits oder Dank an taibeled will Daniel in der App nicht (Stand 2026-10-22); das alte Tutorial enthält noch Links und wird mit Etappe 8 ersetzt.
- Niemals API-Keys oder Zugangsdaten ins Repo schreiben. Der Overpass.ch-Key des Nutzers wird nur in der App unter Einstellungen (Zahnrad oben rechts) → „Overpass API Host" → „Custom URL" eingetragen und liegt im localStorage des Browsers.

## Befehle

```bash
pnpm install          # Abhängigkeiten
pnpm dev              # Entwicklungsserver
pnpm build            # Produktions-Build (muss vor jedem Push durchlaufen)
pnpm vitest run       # Tests einmalig
```

- Im Entwicklungsserver (`pnpm dev`) öffnet sich die Fragen-Seitenleiste nicht aus anderen Inseln heraus (Modul doppelt geladen), also auch nicht über den Knopf „Questions" unten. Das klappt nur im Build: `pnpm build && pnpm preview`.
- `pnpm lint` formatiert das ganze Repo mit Prettier um und erzeugt riesige Diffs. Stattdessen nur geänderte Dateien formatieren: `pnpm eslint --fix <dateien> && pnpm prettier --write <dateien>`.
- Test im Browser (Cloud-Umgebung): `pnpm build && pnpm preview`, dann Chromium aus `/opt/pw-browsers` per Playwright mit `--proxy-server=https=127.0.0.1:<Port aus $HTTPS_PROXY>` starten (sonst landet auch localhost beim Proxy). Daniels Overpass-Zugang nur im Test-Browser per localStorage setzen (`overpassHost` = `custom`, `overpassCustomHost`), nie ins Repo.
- Bekannt und nicht von uns verursacht: 8 Tests in `tests/stationManipulations.test.ts` schlagen fehl (`ReferenceError: require is not defined` aus dem ArcGIS-WASM-Modul unter Vitest). Die übrigen Tests müssen grün bleiben.

## Deployment

- Jeder Push auf `master` startet die GitHub Action „Deploy to GitHub Pages" (`.github/workflows/deploy.yml`). Etwa 2 Minuten später ist die Änderung live, wenn GitHub gleich einen Runner frei hat (manchmal steht der Lauf länger in der Warteschlange).
- Die App ist eine PWA mit `registerType: "autoUpdate"`: Handys holen die neue Version beim nächsten Öffnen und laden die Seite einmal neu.
- Arbeit auf Feature-Branches mit Pull Request. Erst nach dem Merge in `master` wird veröffentlicht. Nichts auf `master` bringen, das nicht baut.
- Beide Teams spielen mit derselben Version. Änderungen an der Logik einer Frage im PR-Text klar benennen, damit die Spieler wissen, was sich geändert hat.

## Wo was liegt

- `src/maps/api/overpass.ts`: alle Overpass-Abfragen, Server-Fallback, `trainLineNodeFinder`, `findPlacesInZone`. Antwortet ein Server mit 429/503 (belegt), fragt `getOverpassData` denselben Server nach `Retry-After` bzw. 2 s nochmal (bis 5-mal); nach 10 s ohne Antwort zusätzlich den nächsten Server; nach 60 s gibt sie auf. Bei Fehlschlag oder „runtime error"-Remark wirft sie `OverpassError` (nichts wird gespeichert) und zeigt eine Meldung mit „Retry".
- overpass.ch (Daniels Zugang, Gratis-Tarif): 10.000 Abfragen/Monat, 30/Minute, nur 1 Abfrage gleichzeitig (sonst 429 `concurrency_limit`).
- `src/maps/api/constants.ts`: `OVERPASS_HOSTS` (die drei öffentlichen Server)
- `src/maps/api/cache.ts`: Browser-Cache (Cache API). Schlüssel ist die komplette URL inklusive Server, ein Serverwechsel heißt also leerer Cache. Der Cache wird nicht mehr geleert, wenn alle Fragen weg sind; nur „New Game" leert ihn, wenn die Daten vor mehr als 7 Tagen erstmals geladen wurden (`gameDataSince`). Ein abgebrochenes Vorladen setzt beim nächsten „New Game" fort, statt neu anzufangen. Jedes Handy hat seinen eigenen Cache und lädt einmal pro Woche selbst (rund 125 Abfragen je Handy).
- `src/maps/preload.ts`: „New Game" (und Einstellungen → „Preload map data") lädt nacheinander Stationen, die Orte aller Deck-Karten (`DECK_PLACE_KINDS`), Schnellfahrstrecken, Inseln, Gewässer, Höhendaten und die Linien jeder Station (rund 125 Abfragen, etwa 8 Minuten, nur wenn nicht schon im Cache). Wartet, solange die Karte rechnet. Der Fortschrittsbalken erscheint erst, wenn wirklich etwas heruntergeladen wird; liegt alles schon im Cache, zeigt der Ladekasten nach ein paar Sekunden nur „Map data for the game is ready". Die Abfragen müssen exakt dieselben sein wie in den Fragen (gleiche URL = Cache-Treffer), deshalb gemeinsame Funktionen wie `findPlacesOfKind`.
- `src/lib/loading.tsx` und `src/components/LoadingIndicator.tsx`: ein Ladekasten oben auf der Karte statt „Finding …"-Meldungen, Fehlermeldung mit „Retry" (`retryTrigger` rechnet Karte, Zonen und abgebrochenes Vorladen neu)
- `src/maps/stations.ts`: die Stationen der Hiding Zones (`findHidingZoneStations`), genutzt von `HidingZones.tsx` und der Bahnhof-Frage
- `src/maps/questions/*.ts`: Logik je Fragetyp. `radius` und `thermometer` rechnen rein lokal; `matching`, `measuring` und `tentacles` holen OSM-Daten.
- `src/maps/schema.ts`: alle Fragetypen. Die Gruppe „Hiding Zone Mode" ist im Dropdown nur aktiv, wenn „Display hiding zones?" eingeschaltet ist.
- `src/pages/index.astro`: Aufbau des Hauptbildschirms. Oben links Zonen-Zähler (`MapControls.tsx`), oben rechts Zahnrad (Einstellungen) und Standort-Knopf, unten die feste Leiste `BottomBar.tsx` mit „Questions" (Fragen-Seitenleiste), „Ask a question" und „Zones". Keine Zoom-, Vollbild- oder Drucken-Knöpfe mehr.
- `src/components/HidingZones.tsx`: rechnet und zeichnet die Hiding Zones (ohne eigene Oberfläche), inklusive der Filter für Stationsfragen („Same train line"). Eine einzelne Zone zeigt sie über `selectedZoneId` (Antippen auf der Karte oder in der Liste). Karte (`Map.tsx`) und Zonen rechnen erst 400 ms nach der letzten Änderung; was während einer Berechnung geändert wird, wird danach nachgeholt.
- `src/components/ZoneSheet.tsx`: Zonenliste als Blatt von unten (Antippen zeigt die Zone, seitlich Wischen oder ✕ streicht sie, `disabledStations`), Darstellung (Zones, Stations, Merged, Hidden) und „Settings" mit Stationsarten, Radius und eigener Stationsliste. `MapControls.tsx`: Zähler „37 of 109 zones left" bzw. Name der gewählten Zone mit „Rule out", Standort-Knopf.
- `src/components/OptionDrawers.tsx`: Einstellungen (Zahnrad): New Game, Share game, Tutorial, Spielgebiet (`PlacePicker`), Save/Load File, „Show drawing tools?" (Zeichenleiste sonst nur beim Zeichnen einer eigenen Frage), danach die alten Optionen
- `src/components/DraggableMarkers.tsx`: Fragen als nummerierte Stecknadeln (Nummer wie im Fragenprotokoll, orangefarbener Ring = wartet auf Antwort, hohle Nadel = Thermometer-Start). Beantwortete Fragen bleiben sichtbar, sind aber nicht verschiebbar. Neue Fragen bekommen nie Grün, Grau oder Schwarz (`randomQuestionColor` in `schema.ts`), damit sie sich von Zonen und grauer Fläche abheben.
- `src/components/PositiveNumberInput.tsx`: Zahlenfeld, das leer sein darf; nur Zahlen über 0 werden übernommen. Für Radius-Felder verwenden, nie `parseFloat(e.target.value)` direkt speichern (leeres Feld = NaN, das hat früher die App lahmgelegt). Kaputte gespeicherte Radien repariert `repairRadius` in `schema.ts`.
- `src/maps/deck.ts`: Small-Deck (20 Matching, 20 Measuring, Radar- und Thermometer-Distanzen) mit Zuordnung zu den Fragetypen der App; geprüft in `tests/deck.test.ts`
- `src/components/AskQuestion.tsx`: großer Knopf „Ask a question" über der unteren Leiste, das laufende Thermometer und der orange Hinweis „Enter answer" für offene Fragen
- `src/maps/answers.ts`: Antwortstatus einer Frage (`status`: `pending`, `answered`, `no-answer`), Antwortknöpfe, Texte fürs Fragenprotokoll; `questionApplies` entscheidet, ob eine Frage die Karte verändert (auch in `HidingZones.tsx`). Geprüft in `tests/answers.test.ts`
- `src/components/cards/answer.tsx`: große Antwortknöpfe und die Protokollzeile beantworteter Fragen
- `src/lib/gps.ts`: GPS-Standort für neue Fragen, Seitenleiste zur neuen Frage öffnen. Der eigene Standort läuft immer mit (blauer Punkt in `Map.tsx`, Atom `myPosition`); `getCurrentPosition` nimmt ihn direkt, wenn er jünger als 15 s ist, sonst wartet sie höchstens 3 s auf einen neuen.
- `src/lib/questionLink.ts`: Frage als Link für den Hider (`?ask=…`, komprimiert, enthält die ganze Frage, braucht beim Hider nichts Gespeichertes); geprüft in `tests/questionLink.test.ts`
- `src/maps/nearest.ts`: „Was ist das Nächste?" je Matching-/Measuring-Frage, von einem Punkt aus (`findNearest`): nächster Ort mit Name und Entfernung, Zone, in der man ist, Abstand zur Bezirksgrenze, Landmasse, Seehöhe. Nutzt dieselben Abfragen wie die Fragen (Cache-Treffer). Angezeigt auf der offenen Frage und in der Protokollzeile (`src/components/cards/nearest.tsx`, wartet, bis die Karte fertig gerechnet hat), als Markierung mit Namen auf der Karte für offene Fragen (`src/components/NearestMarks.tsx`, eigene Leaflet-Pane „nearest") und beim Hider als Grund. Geprüft in `tests/nearest.test.ts`
- `src/components/HiderScreen.tsx` und `src/maps/hider.ts`: Hider-Bildschirm. Öffnet sich über den Frage-Link oder Einstellungen → „Hider mode", holt den GPS-Standort und rechnet die Antwort mit denselben `hiderify*`-Funktionen wie die Karte (`workOutAnswer`), dazu ein Grund nur für den Hider (`explainAnswer`, über `findNearest` für Hider und Sucher). Es gibt keinen Rück-Link: Der Hider schreibt die Antwort im Chat, die Sucher tippen sie selbst ein (Daniels Wunsch).
- `src/lib/context.ts`: persistente Einstellungen (nanostores, localStorage)

## Wien-Besonderheiten (geprüft am 2026-10-22)

- „Same train line" nutzt `findStationLines` (Route-Relationen, Stop-Areas, Haltestellen im Umkreis von 150 m). Früher wurde über `network=VOR` der ganze Verkehrsverbund geladen; das ist behoben.
- Wien Hauptbahnhof ist in OSM in keiner Route-Relation; er wird nur über die 150-m-Nähe gefunden.
- Wiener U-Bahn-Stationen sind `railway=station` + `subway=yes`, S-Bahn-Stationen `railway=station` + `train=yes`.
- Verwaltungsebenen: 2 Österreich, 4 Bundesland Wien, 6 Wien (Statutarstadt), 9 Gemeindebezirke, 10 Katastralgemeinden. Ebene 8 fehlt.
- Landmasse: Einzige eigene Landmasse im Spielgebiet ist die Donauinsel. Gänsehäufel und Rohrinsel liegen in der Alten Donau und zählen zum Festland.
- Der Flughafen Wien liegt außerhalb der Stadtgrenze; Flughafen-Fragen haben laut Regeln keine Antwort. Ebenso Internationale Grenze, Küste und 4. Verwaltungsebene.
- Bekannt, nicht geändert: Die Messfrage „Gemeindebezirk border" misst zur Grenze des Bezirks der Sucher, nicht zur nächsten Bezirksgrenze überhaupt. Für einen Hider in einem anderen Bezirk kann das von den Regeln abweichen. Der Hider-Bildschirm zeigt dazu deshalb keinen Grund.
- In Wien gibt es laut OSM nur eine Schnellfahrstrecke (`highspeed=yes`): die Neue Westbahn. Die Bezirke heißen in OSM ohne Zusatz („Innere Stadt"), die Katastralgemeinden mit („Katastralgemeinde Innere Stadt").
- Wien hat rund 1.150 Parks (`leisure=park`). Die sphärische Voronoi-Berechnung liefert bei so dichten Orten einzelne kaputte Zellen; `nearestVoronoiCell` nimmt deshalb die Zelle des nächsten Orts und fällt bei kaputten Zellen auf eine ebene Rechnung zurück.

## Spielregeln „Small" (Hausregeln, festgelegt am 2026-10-22)

- Fragen: Matching (alle 20), Measuring (alle 20), Radar (alle), Thermometer, keine Tentakel. Quelle: https://jetlag.denull.ru/en/rules/questions (nennt nur Meilen).
- Alles metrisch: In der App stehen nirgends Meilen (Auswahlfelder, Maßstab, Texte, Startwerte). Intern darf weiter in Meilen gerechnet werden.
- Hiding Zones: nur U-Bahn-Stationen, Radius 500 m.
- Radar: 500 m, 1, 2, 5, 10, 15, 40, 80, 160 km. Thermometer: 1 km und 5 km.
- Anfangsbuchstabe und Namenslänge: deutscher Stationsname wie auf dem Schild, nicht `name:en`.
- Verwaltungsebenen: 1. Bundesland (OSM-Ebene 4), 2. Gemeindebezirk (9), 3. Katastralgemeinde (10), 4. gibt es nicht (keine Antwort). In der App heißen die Karten so („Gemeindebezirk", „Gemeindebezirk border"), darunter klein „2nd administrative division".
- Alle Texte in der App auf Englisch, auch neue Bildschirme (Ausnahme: die Verwaltungsbegriffe oben).
- Gewässer: benannte Seen, Teiche, Flüsse und Kanäle; Flussabschnitte unter der Erde (`tunnel`, `covered`, z. B. die Wien unter dem Karlsplatz) zählen nicht, ebenso die Fluss-Relationen, die diese Abschnitte enthalten (`findNamedWaterLines`).

## Plan: App-Überarbeitung

Plan-Dokument: https://claude.ai/artifact/7REdEjsLoZS24z3aziJvBj. Acht Etappen, jede ein eigener Branch mit Pull Request:

1. Sofort-Fixes
2. Wien und Small voreingestellt, alles metrisch („Neues Spiel"-Knopf, nur U-Bahn, 500 m)
3. Fragen wie auf den Karten (Auswahl nach Small-Deck, GPS-Standort, Radar- und Thermometer-Knöpfe)
4. Erst Antwort, dann Karte (Fragen wirken erst nach der Antwort, danach gesperrt)
5. Karte als Hauptbildschirm (drei Knöpfe unten, Zonen-Zähler, GPS-Punkt)
6. Weniger warten (Kartendaten bei „Neues Spiel" vorladen, Bahnhof-Frage für alle Zonen)
7. Hider antwortet per Link
8. Kurzanleitung (auf Englisch)

Nach Etappe 4 gibt es ein Probespiel; danach wird die Reihenfolge von 5 bis 8 festgelegt.

Folgeplan nach Etappe 5 (von Daniel freigegeben): https://claude.ai/artifact/R8gCbhVvDZV3ULd2EsZRH5. Reihenfolge: Etappen 9, 10, 11, dann 8; Etappe 12 nur bei Bedarf. Der Absturz-Fix beim leeren Zahlenfeld steckt schon in Etappe 5.

Einheiten: Spieler sehen nur Meter und Kilometer, intern wird teils in Meilen gerechnet. `HidingZones.tsx` rechnet den Hiding-Zone-Radius deshalb vor den Fragen pro Zone (McDonald's, Bahnhof, Orte) mit `turf.convertLength` in Meilen um. Alte Daten in Meilen (gespeicherte Fragen, Einstellungen, geteilte Links) werden beim Laden in metrische Werte umgerechnet (`milesToKilometers` in `schema.ts`, Migration in `context.ts`, `loadHidingZone` in `OptionDrawers.tsx`).

## Erledigt

- Overpass: nach 10 s parallel den nächsten Server fragen (`OVERPASS_HEDGE_MS`)
- Same train line repariert, Linienauswahl in der Frage
- Nächste Station der Sucher aus allen Stationen (`allTrainStations`), nicht nur aus den verbleibenden Zonen
- Neue Fragen: Straße/Weg, Landmasse, Gewässer, Seehöhe (Terrarium-Höhenkacheln)
- Etappe 1: Augen-Knopf bei Matching/Measuring/Tentakel repariert, „Alle Fragen löschen" nur noch in den Einstellungen, Rückgängig nach dem Löschen, Thermometer-Start 1 km, Google Analytics, Clarity und Partytown entfernt
- Etappe 3: Knopf „Ask a question" mit Auswahl nach Small-Deck, neue Fragen am GPS-Standort, Radar-Knöpfe, Thermometer mit mitlaufender Strecke, Verwaltungsebenen mit Wiener Namen, Experten-Schalter „Show all question types?" (Tentakel und alle Varianten), Park-Frage repariert
- Statusmeldungen (Toasts) lassen Berührungen zur Karte durch, nur ihre Knöpfe (×, Undo) sind antippbar; die Karte springt nach dem Laden nicht zurück, wenn man sie währenddessen bewegt hat
- Etappe 4: Neue Fragen warten auf die Antwort (`status: "pending"`, gestrichelter oranger Umriss, nichts wird gestrichen). Große Antwortknöpfe plus „No answer". Nach der Antwort gesperrt und als Zeile im Protokoll („1 · Radar 2 km · Karlsplatz · Outside · 15:20"), „Edit" öffnet die Frage wieder. Alte gespeicherte Fragen ohne Status gelten als beantwortet. Eine Änderung während die Karte lädt geht nicht mehr verloren (Map.tsx rechnet danach nochmal). Stationsnamen-Länge kennt jetzt auch „Different"
- Etappe 6: Vorladen bei „New Game", Cache bleibt beim Löschen der Fragen, Ladekasten statt Meldungen, „Retry" bei hängenden Servern, Karte rechnet erst nach dem Tippen. Bahnhof-Frage (Measuring „Rail Station") wirkt jetzt auf die ganze Karte: Kreise mit dem Abstand der Sucher zu ihrer nächsten Station um alle Hiding-Zone-Stationen (nicht mehr nur beim Antippen einer Zone).
- Etappe 7: Knopf „Send to hider" bei offenen Fragen (Link per Teilen-Menü, sonst Zwischenablage). Der Link öffnet beim Hider einen eigenen Bildschirm „Hider mode" (statt Häkchen in den Optionen) mit GPS-Standort, Antwort und Grund. Eigene Frage-Links schalten nicht in den Hider-Modus; ein Handy mit offenen eigenen Fragen fragt erst „Are you the hider?". Im Hider-Modus zeigt die Karte statt „Ask a question" den Knopf „Hider mode".
- Etappe 2: Start in Wien (OSM-Relation 109166) mit Hiding Zones an U-Bahn-Stationen und 500 m, Knopf „New Game" (`NewGameDialog.tsx`), überall metrisch (Radar-Start 5 km), Tutorial startet nicht mehr von selbst, Stationsnamen nach `name` statt `name:en` (auch im Hider-Modus, der jetzt dieselben Stationsarten wie die Hiding Zones nutzt)
- Etappe 5: Karte als Hauptbildschirm. Unten feste Leiste mit „Questions", „Ask a question", „Zones"; oben Zonen-Zähler, Zahnrad und Standort-Knopf. Zoom, Vollbild, Drucken, Stecknadel-Knopf und „Star this on GitHub" entfernt; „Add Question" nur noch mit „Show all question types?". Eigener Standort immer als blauer Punkt (Option „Follow Me" entfällt). Ausgeschlossene Fläche grau, Fragen als nummerierte Stecknadeln. Zonenliste als Blatt von unten, Antippen einer Zone (Liste oder Karte) zeigt sie mit Stationsnamen. Absturz bei geleertem Zahlenfeld behoben.
- Etappe 9: Jede Matching-/Measuring-Frage zeigt das Nächste („Nearest museum: Albertina, 350 m", „You are in Gemeindebezirk Wieden") auf der Frage, im Protokoll und als Markierung mit Namen auf der Karte. Kurze Erklärzeile, was zählt, bei der Auswahl und auf der Frage. Verwaltungsebenen heißen Bundesland, Gemeindebezirk, Katastralgemeinde. Angetippte Zone zeigt U-Bahn- und S-Bahn-Linien („Karlsplatz · U1 U2 U4"). Unterirdische Flüsse zählen nicht mehr als Gewässer.
