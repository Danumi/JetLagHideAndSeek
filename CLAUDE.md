# Jet Lag Hide & Seek – Wien-Version

Fork von [taibeled/JetLagHideAndSeek](https://github.com/taibeled/JetLagHideAndSeek) (MIT-Lizenz), den wir für Spiele in Wien anpassen.
Live-Version: https://danumi.github.io/JetLagHideAndSeek/

## Zusammenarbeit

- Der Nutzer spricht Deutsch: Antworten und Erklärungen auf Deutsch. Code, Kommentare und Commit-Messages auf Englisch.
- Die App bleibt durchgängig auf Englisch (wie das Spiel selbst): alle Texte, Knöpfe, Dialoge und Meldungen. Keine deutschen Texte in die App einbauen. Ausnahme sind nur Namen aus OSM (Stationsnamen wie auf dem Schild).
- Der Nutzer ist kein Entwickler. Änderungen in Alltagssprache erklären (was ändert sich im Spiel?), nicht im Code-Jargon.
- Lizenzhinweis und Credits des Originalautors (LICENSE, Links zu taibeled im Tutorial und in der Seitenleiste) bleiben erhalten.
- Niemals API-Keys oder Zugangsdaten ins Repo schreiben. Der Overpass.ch-Key des Nutzers wird nur in der App unter Optionen → „Overpass API Host" → „Custom URL" eingetragen und liegt im localStorage des Browsers.

## Befehle

```bash
pnpm install          # Abhängigkeiten
pnpm dev              # Entwicklungsserver
pnpm build            # Produktions-Build (muss vor jedem Push durchlaufen)
pnpm vitest run       # Tests einmalig
```

- Im Entwicklungsserver (`pnpm dev`) öffnet sich die Fragen-Seitenleiste nicht aus anderen Inseln heraus (Modul doppelt geladen). Das klappt nur im Build: `pnpm build && pnpm preview`.
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
- `src/maps/preload.ts`: „New Game" (und Optionen → „Preload map data") lädt nacheinander Stationen, die Orte aller Deck-Karten (`DECK_PLACE_KINDS`), Schnellfahrstrecken, Inseln, Gewässer, Höhendaten und die Linien jeder Station (rund 125 Abfragen, etwa 8 Minuten, nur wenn nicht schon im Cache). Wartet, solange die Karte rechnet. Die Abfragen müssen exakt dieselben sein wie in den Fragen (gleiche URL = Cache-Treffer), deshalb gemeinsame Funktionen wie `findPlacesOfKind`.
- `src/lib/loading.tsx` und `src/components/LoadingIndicator.tsx`: ein Ladekasten oben auf der Karte statt „Finding …"-Meldungen, Fehlermeldung mit „Retry" (`retryTrigger` rechnet Karte, Zonen und abgebrochenes Vorladen neu)
- `src/maps/stations.ts`: die Stationen der Hiding Zones (`findHidingZoneStations`), genutzt von `ZoneSidebar.tsx` und der Bahnhof-Frage
- `src/maps/questions/*.ts`: Logik je Fragetyp. `radius` und `thermometer` rechnen rein lokal; `matching`, `measuring` und `tentacles` holen OSM-Daten.
- `src/maps/schema.ts`: alle Fragetypen. Die Gruppe „Hiding Zone Mode" ist im Dropdown nur aktiv, wenn „Display hiding zones?" eingeschaltet ist.
- `src/components/ZoneSidebar.tsx`: Hiding Zones und die Filter für Stationsfragen (inklusive „Same train line"). Karte (`Map.tsx`) und Zonen rechnen erst 400 ms nach der letzten Änderung; was während einer Berechnung geändert wird, wird danach nachgeholt.
- `src/components/OptionDrawers.tsx`: Einstellungen
- `src/maps/deck.ts`: Small-Deck (20 Matching, 20 Measuring, Radar- und Thermometer-Distanzen) mit Zuordnung zu den Fragetypen der App; geprüft in `tests/deck.test.ts`
- `src/components/AskQuestion.tsx`: großer Knopf „Ask a question" über der unteren Leiste, das laufende Thermometer und der orange Hinweis „Enter answer" für offene Fragen
- `src/maps/answers.ts`: Antwortstatus einer Frage (`status`: `pending`, `answered`, `no-answer`), Antwortknöpfe, Texte fürs Fragenprotokoll; `questionApplies` entscheidet, ob eine Frage die Karte verändert (auch in `ZoneSidebar.tsx`). Geprüft in `tests/answers.test.ts`
- `src/components/cards/answer.tsx`: große Antwortknöpfe und die Protokollzeile beantworteter Fragen
- `src/lib/gps.ts`: GPS-Standort für neue Fragen, Seitenleiste zur neuen Frage öffnen
- `src/lib/context.ts`: persistente Einstellungen (nanostores, localStorage)

## Wien-Besonderheiten (geprüft am 2026-10-22)

- „Same train line" nutzt `findStationLines` (Route-Relationen, Stop-Areas, Haltestellen im Umkreis von 150 m). Früher wurde über `network=VOR` der ganze Verkehrsverbund geladen; das ist behoben.
- Wien Hauptbahnhof ist in OSM in keiner Route-Relation; er wird nur über die 150-m-Nähe gefunden.
- Wiener U-Bahn-Stationen sind `railway=station` + `subway=yes`, S-Bahn-Stationen `railway=station` + `train=yes`.
- Verwaltungsebenen: 2 Österreich, 4 Bundesland Wien, 6 Wien (Statutarstadt), 9 Gemeindebezirke, 10 Katastralgemeinden. Ebene 8 fehlt.
- Landmasse: Einzige eigene Landmasse im Spielgebiet ist die Donauinsel. Gänsehäufel und Rohrinsel liegen in der Alten Donau und zählen zum Festland.
- Der Flughafen Wien liegt außerhalb der Stadtgrenze; Flughafen-Fragen haben laut Regeln keine Antwort. Ebenso Internationale Grenze, Küste und 4. Verwaltungsebene.
- Wien hat rund 1.150 Parks (`leisure=park`). Die sphärische Voronoi-Berechnung liefert bei so dichten Orten einzelne kaputte Zellen; `nearestVoronoiCell` nimmt deshalb die Zelle des nächsten Orts und fällt bei kaputten Zellen auf eine ebene Rechnung zurück.

## Spielregeln „Small" (Hausregeln, festgelegt am 2026-10-22)

- Fragen: Matching (alle 20), Measuring (alle 20), Radar (alle), Thermometer, keine Tentakel. Quelle: https://jetlag.denull.ru/en/rules/questions (nennt nur Meilen).
- Alles metrisch: In der App stehen nirgends Meilen (Auswahlfelder, Maßstab, Texte, Startwerte). Intern darf weiter in Meilen gerechnet werden.
- Hiding Zones: nur U-Bahn-Stationen, Radius 500 m.
- Radar: 500 m, 1, 2, 5, 10, 15, 40, 80, 160 km. Thermometer: 1 km und 5 km.
- Anfangsbuchstabe und Namenslänge: deutscher Stationsname wie auf dem Schild, nicht `name:en`.
- Verwaltungsebenen: 1. Bundesland (OSM-Ebene 4), 2. Gemeindebezirk (9), 3. Katastralgemeinde (10), 4. gibt es nicht (keine Antwort).
- Alle Texte in der App auf Englisch, auch neue Bildschirme.

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

Einheiten: Spieler sehen nur Meter und Kilometer, intern wird teils in Meilen gerechnet. `ZoneSidebar.tsx` rechnet den Hiding-Zone-Radius deshalb vor den Fragen pro Zone (McDonald's, Bahnhof, Orte) mit `turf.convertLength` in Meilen um. Alte Daten in Meilen (gespeicherte Fragen, Einstellungen, geteilte Links) werden beim Laden in metrische Werte umgerechnet (`milesToKilometers` in `schema.ts`, Migration in `context.ts`, `loadHidingZone` in `OptionDrawers.tsx`).

## Erledigt

- Overpass: nach 10 s parallel den nächsten Server fragen (`OVERPASS_HEDGE_MS`)
- Same train line repariert, Linienauswahl in der Frage
- Nächste Station der Sucher aus allen Stationen (`allTrainStations`), nicht nur aus den verbleibenden Zonen
- Neue Fragen: Straße/Weg, Landmasse, Gewässer, Seehöhe (Terrarium-Höhenkacheln)
- Etappe 1: Augen-Knopf bei Matching/Measuring/Tentakel repariert, „Alle Fragen löschen" nur noch in den Optionen, Rückgängig nach dem Löschen, Thermometer-Start 1 km, Google Analytics, Clarity und Partytown entfernt
- Etappe 3: Knopf „Ask a question" mit Auswahl nach Small-Deck, neue Fragen am GPS-Standort, Radar-Knöpfe, Thermometer mit mitlaufender Strecke, Verwaltungsebenen mit Wiener Namen, Experten-Schalter „Show all question types?" (Tentakel und alle Varianten), Park-Frage repariert
- Statusmeldungen (Toasts) lassen Berührungen zur Karte durch, nur ihre Knöpfe (×, Undo) sind antippbar; die Karte springt nach dem Laden nicht zurück, wenn man sie währenddessen bewegt hat
- Etappe 4: Neue Fragen warten auf die Antwort (`status: "pending"`, gestrichelter oranger Umriss, nichts wird gestrichen). Große Antwortknöpfe plus „No answer". Nach der Antwort gesperrt und als Zeile im Protokoll („1 · Radar 2 km · Karlsplatz · Outside · 15:20"), „Edit" öffnet die Frage wieder. Alte gespeicherte Fragen ohne Status gelten als beantwortet. Eine Änderung während die Karte lädt geht nicht mehr verloren (Map.tsx rechnet danach nochmal). Stationsnamen-Länge kennt jetzt auch „Different"
- Etappe 6: Vorladen bei „New Game", Cache bleibt beim Löschen der Fragen, Ladekasten statt Meldungen, „Retry" bei hängenden Servern, Karte rechnet erst nach dem Tippen. Bahnhof-Frage (Measuring „Rail Station") wirkt jetzt auf die ganze Karte: Kreise mit dem Abstand der Sucher zu ihrer nächsten Station um alle Hiding-Zone-Stationen (nicht mehr nur beim Antippen einer Zone).
- Etappe 2: Start in Wien (OSM-Relation 109166) mit Hiding Zones an U-Bahn-Stationen und 500 m, Knopf „New Game" (`NewGameDialog.tsx`), überall metrisch (Radar-Start 5 km), Tutorial startet nicht mehr von selbst, Stationsnamen nach `name` statt `name:en` (auch im Hider-Modus, der jetzt dieselben Stationsarten wie die Hiding Zones nutzt)
