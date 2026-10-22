# Jet Lag Hide & Seek – Wien-Version

Fork von [taibeled/JetLagHideAndSeek](https://github.com/taibeled/JetLagHideAndSeek) (MIT-Lizenz), den wir für Spiele in Wien anpassen.
Live-Version: https://danumi.github.io/JetLagHideAndSeek/

## Zusammenarbeit

- Der Nutzer spricht Deutsch: Antworten und Erklärungen auf Deutsch. Code, Kommentare und Commit-Messages auf Englisch.
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

- `pnpm lint` formatiert das ganze Repo mit Prettier um und erzeugt riesige Diffs. Stattdessen nur geänderte Dateien formatieren: `pnpm eslint --fix <dateien> && pnpm prettier --write <dateien>`.
- Bekannt und nicht von uns verursacht: 8 Tests in `tests/stationManipulations.test.ts` schlagen fehl (`ReferenceError: require is not defined` aus dem ArcGIS-WASM-Modul unter Vitest). Die übrigen Tests müssen grün bleiben.

## Deployment

- Jeder Push auf `master` startet die GitHub Action „Deploy to GitHub Pages" (`.github/workflows/deploy.yml`). Etwa 2 Minuten später ist die Änderung live.
- Arbeit auf Feature-Branches mit Pull Request. Erst nach dem Merge in `master` wird veröffentlicht. Nichts auf `master` bringen, das nicht baut.
- Beide Teams spielen mit derselben Version. Änderungen an der Logik einer Frage im PR-Text klar benennen, damit die Spieler wissen, was sich geändert hat.

## Wo was liegt

- `src/maps/api/overpass.ts`: alle Overpass-Abfragen, Server-Fallback, `trainLineNodeFinder`, `findPlacesInZone`
- `src/maps/api/constants.ts`: `OVERPASS_HOSTS` (die drei öffentlichen Server)
- `src/maps/api/cache.ts`: Browser-Cache (Cache API). Schlüssel ist die komplette URL inklusive Server, ein Serverwechsel heißt also leerer Cache.
- `src/maps/questions/*.ts`: Logik je Fragetyp. `radius` und `thermometer` rechnen rein lokal; `matching`, `measuring` und `tentacles` holen OSM-Daten.
- `src/maps/schema.ts`: alle Fragetypen. Die Gruppe „Hiding Zone Mode" ist im Dropdown nur aktiv, wenn „Display hiding zones?" eingeschaltet ist.
- `src/components/ZoneSidebar.tsx`: Hiding Zones und die Filter für Stationsfragen (inklusive „Same train line")
- `src/components/OptionDrawers.tsx`: Einstellungen
- `src/lib/context.ts`: persistente Einstellungen (nanostores, localStorage)

## Wien-Besonderheiten (geprüft am 2026-10-22)

- „Same train line" nutzt `findStationLines` (Route-Relationen, Stop-Areas, Haltestellen im Umkreis von 150 m). Früher wurde über `network=VOR` der ganze Verkehrsverbund geladen; das ist behoben.
- Wien Hauptbahnhof ist in OSM in keiner Route-Relation; er wird nur über die 150-m-Nähe gefunden.
- Wiener U-Bahn-Stationen sind `railway=station` + `subway=yes`, S-Bahn-Stationen `railway=station` + `train=yes`.
- Verwaltungsebenen: 2 Österreich, 4 Bundesland Wien, 6 Wien (Statutarstadt), 9 Gemeindebezirke, 10 Katastralgemeinden. Ebene 8 fehlt.
- Landmasse: Einzige eigene Landmasse im Spielgebiet ist die Donauinsel. Gänsehäufel und Rohrinsel liegen in der Alten Donau und zählen zum Festland.
- Der Flughafen Wien liegt außerhalb der Stadtgrenze; Flughafen-Fragen haben laut Regeln keine Antwort.

## Spielregeln „Small"

Matching (alle 20), Measuring (alle 20), Radar (alle), Thermometer ½ und 3 Meilen, keine Tentakel. Hiding-Zone-Radius ¼ Meile (0.25 mi). Quelle: https://jetlag.denull.ru/en/rules/questions

## Erledigt

- Overpass: nach 10 s parallel den nächsten Server fragen (`OVERPASS_HEDGE_MS`)
- Same train line repariert, Linienauswahl in der Frage
- Nächste Station der Sucher aus allen Stationen (`allTrainStations`), nicht nur aus den verbleibenden Zonen
- Neue Fragen: Straße/Weg, Landmasse, Gewässer, Seehöhe (Terrarium-Höhenkacheln)

## Ideen für später

- Knopf „Daten fürs Spiel vorladen"
- Wien-Voreinstellung und optional deutsche Oberfläche
