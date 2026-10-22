import type { Text } from "@/lib/i18n";

/*
 * Every text the app writes itself, in English and German. {name} is filled
 * in where the text is used. Matching, Measuring, Radar and Thermometer stay
 * as in the game; the German texts say "Hider" and "Seeker" like the players
 * do. tests/i18n.test.ts checks that each text has both versions.
 */

export const messages = {
    // Shared buttons
    "common.cancel": { en: "Cancel", de: "Abbrechen" },
    "common.delete": { en: "Delete", de: "Löschen" },
    "common.back": { en: "Back", de: "Zurück" },

    // Settings: the language of this phone
    "settings.language": { en: "Language", de: "Sprache" },

    // The bar below the map
    "bar.questions": { en: "Questions", de: "Fragen" },
    "bar.zones": { en: "Zones", de: "Zonen" },
    "bar.hiderMode": { en: "Hider mode", de: "Hider-Modus" },
    "pick.hiding": {
        en: "Tap where you are hiding",
        de: "Tippe dorthin, wo du dich versteckst",
    },
    "pick.start": {
        en: "Tap where the thermometer started",
        de: "Tippe dorthin, wo das Thermometer gestartet ist",
    },
    "pick.end": {
        en: "Tap where the thermometer ended",
        de: "Tippe dorthin, wo das Thermometer geendet hat",
    },
    "pick.question": {
        en: "Tap where the question was asked",
        de: "Tippe dorthin, wo die Frage gestellt wurde",
    },

    // Top of the map: zones left, the tapped zone, your location
    "zones.left": {
        en: "{left} of {total} zones left",
        de: "{left} von {total} Zonen übrig",
    },
    "zones.showAll": { en: "Show all zones", de: "Alle Zonen zeigen" },
    "zones.ruleOut": { en: "Rule out", de: "Streichen" },
    "zones.backIn": { en: "Back in", de: "Zurückholen" },
    "zones.onlyThis": { en: "Only this zone", de: "Nur diese Zone" },
    "zones.yours": { en: "Your hiding zone", de: "Deine Zone" },
    "zones.choose": { en: "Choose as my zone", de: "Als meine Zone wählen" },
    "zones.changeTitle": {
        en: "Change your hiding zone?",
        de: "Zone wechseln?",
    },
    "zones.changeText": {
        en: "Your zone is {current}. For the endgame, only {name} will count.",
        de: "Deine Zone ist {current}. Im Endspiel zählt dann nur noch {name}.",
    },
    "zones.changeTo": { en: "Change to {name}", de: "Wechseln zu {name}" },
    "zones.keep": { en: "Keep {name}", de: "{name} behalten" },
    "zones.left.toast": {
        en: "You left your hiding zone: the {station} zone is {distance} away.",
        de: "Du hast deine Zone verlassen: Die Zone {station} ist {distance} entfernt.",
    },
    "locate.following": {
        en: "The map follows you",
        de: "Die Karte folgt dir",
    },
    "locate.show": { en: "Show my location", de: "Meinen Standort zeigen" },
    "locate.failed": {
        en: "Couldn't get your location.",
        de: "Dein Standort ließ sich nicht bestimmen.",
    },

    // The kinds of questions
    "kind.matching.question": {
        en: "Is your nearest ___ the same as mine?",
        de: "Ist dein Nächstes dasselbe wie unseres?",
    },
    "kind.measuring.question": {
        en: "Compared to me, are you closer to or further from ___?",
        de: "Bist du näher dran als wir?",
    },
    "kind.radar.question": {
        en: "Are you within ___ of me?",
        de: "Bist du im Umkreis?",
    },
    "kind.thermometer.question": {
        en: "After traveling ___, am I hotter or colder?",
        de: "Sind wir dir näher gekommen?",
    },
    "kind.tentacles": { en: "Tentacles", de: "Tentakel" },

    // "Ask a question"
    "ask.button": { en: "Ask a question", de: "Frage stellen" },
    "ask.description": {
        en: "The question starts at your GPS location.",
        de: "Die Frage wird an deinem GPS-Standort gestellt.",
    },
    "ask.noAnswer": {
        en: "No answer in Vienna. {reason}",
        de: "Keine Antwort in Wien. {reason}",
    },
    "ask.needsZones": {
        en: "Turn on hiding zones first (Zones → Settings).",
        de: "Schalte zuerst die Zonen ein (Zonen → Einstellungen).",
    },
    "ask.radar.choose": { en: "Choose:", de: "Andere:" },
    "ask.radar.ask": { en: "Ask", de: "Fragen" },
    "ask.thermometer.help": {
        en: 'Starts at your current location. Send it to the hider, then travel; the app shows the distance as the crow flies. Tap "Set end here" when you are far enough.',
        de: "Startet an deinem aktuellen Standort. Schick die Frage an den Hider, dann fahr los; die App zeigt die Entfernung in Luftlinie. Tippe auf „Ende hier setzen“, wenn du weit genug bist.",
    },
    "ask.thermometer.start": { en: "Start {distance}", de: "Start {distance}" },
    "ask.thermometer.noLocation": {
        en: 'Couldn\'t get your location. Set where you started and stopped with "Pick on map".',
        de: "Dein Standort ließ sich nicht bestimmen. Setze Start und Ende mit „Auf Karte wählen“.",
    },
    "waiting.one": {
        en: "Enter answer: {title}",
        de: "Antwort eintragen: {title}",
    },
    "waiting.many": {
        en: "{count} questions waiting for an answer",
        de: "{count} Fragen warten auf eine Antwort",
    },

    // The thermometer on its way
    "thermometer.crowFlies": { en: "as the crow flies", de: "Luftlinie" },
    "thermometer.progress": {
        en: "{traveled} of {target}",
        de: "{traveled} von {target}",
    },
    "thermometer.noSignal": { en: "No GPS signal", de: "Kein GPS-Signal" },
    "thermometer.waiting": { en: "Waiting for GPS...", de: "Warte auf GPS …" },
    "thermometer.tooShort": {
        en: "You have traveled {traveled}, the card needs {target}. Set the end here anyway?",
        de: "Du bist erst {traveled} gefahren, die Karte verlangt {target}. Trotzdem hier das Ende setzen?",
    },
    "thermometer.setEnd": { en: "Set end here", de: "Ende hier setzen" },
    "thermometer.cancel": {
        en: "Cancel this thermometer?",
        de: "Dieses Thermometer abbrechen?",
    },
    "thermometer.endAtCenter": {
        en: "Set end at the map center instead",
        de: "Stattdessen Ende in der Kartenmitte setzen",
    },

    // The question list
    "sidebar.title": { en: "Questions", de: "Fragen" },
    "sidebar.empty": {
        en: 'No questions yet. Tap "Ask a question" below the map.',
        de: "Noch keine Fragen. Tippe unter der Karte auf „Frage stellen“.",
    },
    "sidebar.open": { en: "Open", de: "Offen" },
    "sidebar.answered": { en: "Answered", de: "Beantwortet" },
    "sidebar.addQuestion": { en: "Add Question", de: "Frage hinzufügen" },

    // Pins on the map
    "pin.hidingSpot": { en: "Your hiding spot", de: "Dein Versteck" },
    "pin.hiderHelp": {
        en: 'Without GPS, this marker shows where you are hiding. Drag it there, or tap "Pick on map" and then tap the spot.',
        de: "Ohne GPS zeigt diese Nadel, wo du dich versteckst. Zieh sie dorthin, oder tippe auf „Auf Karte wählen“ und dann auf die Stelle.",
    },

    // A question card
    "card.showOnMap": { en: "Show on map", de: "Auf Karte zeigen" },
    "card.hideOnMap": { en: "Hide on map", de: "Auf Karte ausblenden" },
    "card.deleteTitle": { en: "Delete question?", de: "Frage löschen?" },
    "card.deleteText": {
        en: "The question disappears from the map. You can undo this right afterwards.",
        de: "Die Frage verschwindet von der Karte. Du kannst das gleich danach rückgängig machen.",
    },
    "card.question": { en: "Question", de: "Frage" },
    "card.needsZones": {
        en: "This question needs the hiding zones. Turn them on under Zones → Settings.",
        de: "Diese Frage braucht die Zonen. Schalte sie unter Zonen → Einstellungen ein.",
    },
    "card.adminLevel": { en: "Administrative level", de: "Verwaltungsebene" },
    "card.unit": { en: "Unit", de: "Einheit" },
    "card.kilometers": { en: "Kilometers", de: "Kilometer" },
    "card.meters": { en: "Meters", de: "Meter" },
    "card.radar.choose": { en: "Choose", de: "Andere" },
    "card.onlyInZone": {
        en: "This question only changes the map when you open a hiding zone (tap it on the map or in the Zones list).",
        de: "Diese Frage ändert die Karte nur, wenn du eine Zone öffnest (auf der Karte oder in der Zonenliste antippen).",
    },
    "card.drawZone": {
        en: "Please draw the zone on the map.",
        de: "Bitte zeichne die Zone auf der Karte ein.",
    },
    "card.drawPoints": {
        en: "Please draw the points on the map.",
        de: "Bitte zeichne die Punkte auf der Karte ein.",
    },
    "card.drawBefore": {
        en: "To modify the {what}, enable it:",
        de: "Um {what} zu ändern, hier einschalten:",
    },
    "card.drawAfter": {
        en: "and use the buttons at the bottom left of the map.",
        de: "und die Knöpfe unten links auf der Karte verwenden.",
    },
    "card.drawZones": { en: "matching zones", de: "die Zonen" },
    "card.drawMatchingPoints": { en: "matching points", de: "die Punkte" },
    "card.drawMeasuring": {
        en: "measuring question",
        de: "die Measuring-Frage",
    },
    "card.matchingType": { en: "Matching Type", de: "Matching-Art" },
    "card.measuringType": { en: "Measuring Type", de: "Measuring-Art" },

    // Matching cards
    "matching.line.noZones": {
        en: "Turn on hiding zones to choose the seekers' line.",
        de: "Schalte die Zonen ein, um die Linie der Seeker zu wählen.",
    },
    "matching.line.loading": {
        en: "Loading lines at {station}...",
        de: "Lade die Linien bei {station} …",
    },
    "matching.line.failed": {
        en: "The lines at {station} didn't load.",
        de: "Die Linien bei {station} haben nicht geladen.",
    },
    "matching.line.none": {
        en: "No lines found at {station}.",
        de: "Bei {station} wurden keine Linien gefunden.",
    },
    "matching.line.select": { en: "Seekers' line", de: "Linie der Seeker" },
    "matching.line.any": {
        en: "Line not chosen (safe eliminations only)",
        de: "Keine Linie gewählt (nur sichere Ausschlüsse)",
    },
    "matching.line.note": {
        en: "The lines come from this app's map data, so the hider should answer with this app too.",
        de: "Die Linien stammen aus den Kartendaten dieser App, deshalb sollte auch der Hider mit dieser App antworten.",
    },
    "matching.letterZone.note": {
        en: "The borders are simplified by about 100 m so the phone can handle them.",
        de: "Die Grenzen sind um etwa 100 m vereinfacht, damit das Handy sie schafft.",
    },
    "matching.street.note": {
        en: '"Same" keeps everything within 200 m of that street; "different" can\'t rule anything out reliably.',
        de: "„Gleich“ behält alles im Umkreis von 200 m um diese Straße; „Verschieden“ kann nichts sicher ausschließen.",
    },
    "matching.landmass.note": {
        en: "Islands in lakes count as part of the surrounding land.",
        de: "Inseln in Seen zählen zum Land rundherum.",
    },

    // Measuring cards
    "measuring.seaLevel.note": {
        en: "Elevation from terrain data, accurate to a few meters.",
        de: "Höhe aus Geländedaten, auf wenige Meter genau.",
    },
    "measuring.water.note": {
        en: "Pools, fountains, streams and underground rivers don't count.",
        de: "Schwimmbecken, Brunnen, Bäche und unterirdische Flüsse zählen nicht.",
    },
    "measuring.zones.note": {
        en: "This question rules out hiding zones that don't fit. When you open a zone, the parts of it that don't fit turn grey.",
        de: "Diese Frage streicht Zonen, die nicht passen. Öffnest du eine Zone, werden die Teile grau, die nicht passen.",
    },

    // Thermometer card
    "thermometer.note": {
        en: "Warmer: the hider is closer to the end than to the start (the hollow pin).",
        de: "Wärmer: Der Hider ist näher am Ende als am Start (der hohlen Nadel).",
    },

    // Where a question was asked
    "location.askedAt": { en: "Asked at", de: "Gefragt" },
    "location.start": { en: "Start", de: "Start" },
    "location.end": { en: "End", de: "Ende" },
    "location.near": { en: "near {station}", de: "bei {station}" },
    "location.pin": {
        en: "its pin on the map",
        de: "siehe Nadel auf der Karte",
    },
    "location.accuracyTitle": {
        en: "How precise the GPS location was",
        de: "Wie genau der GPS-Standort war",
    },
    "location.imprecise": {
        en: 'GPS was only accurate to ±{meters} m. Check the pin, or set it with "Pick on map".',
        de: "Das GPS war nur auf ±{meters} m genau. Prüfe die Nadel oder setze sie mit „Auf Karte wählen“.",
    },
    "location.useMine": { en: "Use my location", de: "Mein Standort" },
    "location.pickOnMap": { en: "Pick on map", de: "Auf Karte wählen" },

    // Answers
    "answer.inside": { en: "Inside", de: "Innerhalb" },
    "answer.outside": { en: "Outside", de: "Außerhalb" },
    "answer.warmer": { en: "Warmer", de: "Wärmer" },
    "answer.colder": { en: "Colder", de: "Kälter" },
    "answer.closer": { en: "Closer", de: "Näher" },
    "answer.further": { en: "Further", de: "Weiter weg" },
    "answer.same": { en: "Same", de: "Gleich" },
    "answer.different": { en: "Different", de: "Verschieden" },
    "answer.shorter": { en: "Shorter", de: "Kürzer" },
    "answer.longer": { en: "Longer", de: "Länger" },
    "answer.waiting": { en: "Waiting for answer", de: "Wartet auf Antwort" },
    "answer.none": { en: "No answer", de: "Keine Antwort" },
    "answer.place": { en: "Place", de: "Ort" },
    "answer.notWithin": { en: "Not within", de: "Nicht im Umkreis" },
    "answer.waitingForHider": {
        en: "Waiting for the hider's answer",
        de: "Wartet auf die Antwort des Hiders",
    },
    "answer.tapToSave": {
        en: "Hider's answer (tap one to save)",
        de: "Antwort des Hiders (zum Speichern antippen)",
    },
    "answer.save": { en: "Save answer", de: "Antwort speichern" },
    "answer.edit": { en: "Edit", de: "Ändern" },
    "answer.hiddenOnMap": {
        en: "hidden on the map",
        de: "auf der Karte ausgeblendet",
    },

    // "Send to hider"
    "send.button": { en: "Send to hider", de: "An Hider senden" },
    "send.message": {
        en: "Question for the hider: {title}\nOpen this link to see your answer: {link}",
        de: "Frage an den Hider: {title}\nÖffne diesen Link, um deine Antwort zu sehen: {link}",
    },
    "send.copied": {
        en: "Link copied. Paste it into your chat with the hider.",
        de: "Link kopiert. Füge ihn in den Chat mit dem Hider ein.",
    },
    "send.failed": {
        en: "Couldn't share. Send the hider this link: {link}",
        de: "Teilen hat nicht geklappt. Schick dem Hider diesen Link: {link}",
    },
    "send.linkFailed": {
        en: "Couldn't make the link: {error}",
        de: "Der Link ließ sich nicht erstellen: {error}",
    },

    // What's nearest to a question
    "nearest.loading": {
        en: "Finding what's nearest...",
        de: "Suche das Nächste …",
    },
    "nearest.failed": {
        en: "Couldn't find what's nearest.",
        de: "Das Nächste ließ sich nicht finden.",
    },
    "nearest.distance": {
        en: "{nearest}: {name}, {distance}",
        de: "{nearest}: {name}, {distance}",
    },
    "nearest.inside": { en: "You are {zone}", de: "Du bist {zone}" },
    "nearest.on": { en: "You are {land}", de: "Du bist {land}" },
    "nearest.border": {
        en: "You are {distance} from the border of {zone}",
        de: "Du bist {distance} von der Grenze entfernt ({zone})",
    },
    "nearest.elevation": {
        en: "You are {meters} m above sea level",
        de: "Du bist auf {meters} m Seehöhe",
    },
    "nearest.characters": {
        en: "{name} ({count} characters)",
        de: "{name} ({count} Zeichen)",
    },
    "nearest.unnamed": { en: "an unnamed {what}", de: "{what} ohne Namen" },
    "nearest.unnamedMark": { en: "Unnamed {what}", de: "{what} ohne Namen" },
    "nearest.in": { en: "in {zone}", de: "in {zone}" },
    "nearest.in.4": { en: "in {zone}", de: "im {zone}" },
    "nearest.in.9": { en: "in {zone}", de: "im {zone}" },
    "nearest.in.10": { en: "in {zone}", de: "in der {zone}" },
    "nearest.mainland": { en: "on the mainland", de: "auf dem Festland" },
    "nearest.island": { en: "on an island", de: "auf einer Insel" },
    // The only separate landmass in Vienna is the Donauinsel
    "nearest.onIsland": { en: "on {name}", de: "auf der {name}" },
    "nearest.islandMark": { en: "Island", de: "Insel" },
    "nearest.borderMark": { en: "{name} border", de: "Grenze {name}" },
    "nearest.title.other": { en: "Nearest {what}", de: "Nächstes: {what}" },
    "nearest.title.amusement-park": {
        en: "Nearest amusement park",
        de: "Nächster Vergnügungspark",
    },
    "nearest.title.zoo": { en: "Nearest zoo", de: "Nächster Zoo" },
    "nearest.title.aquarium": {
        en: "Nearest aquarium",
        de: "Nächstes Aquarium",
    },
    "nearest.title.golf-course": {
        en: "Nearest golf course",
        de: "Nächster Golfplatz",
    },
    "nearest.title.museum": { en: "Nearest museum", de: "Nächstes Museum" },
    "nearest.title.movie-theater": {
        en: "Nearest movie theater",
        de: "Nächstes Kino",
    },
    "nearest.title.hospital": {
        en: "Nearest hospital",
        de: "Nächstes Krankenhaus",
    },
    "nearest.title.library": {
        en: "Nearest library",
        de: "Nächste Bibliothek",
    },
    "nearest.title.consulate": {
        en: "Nearest foreign consulate",
        de: "Nächstes ausländisches Konsulat",
    },
    "nearest.title.mountain": { en: "Nearest mountain", de: "Nächster Berg" },
    "nearest.title.park": { en: "Nearest park", de: "Nächster Park" },
    "nearest.title.station": { en: "Nearest station", de: "Nächste Station" },
    "nearest.title.street": {
        en: "Nearest street or path",
        de: "Nächste Straße oder nächster Weg",
    },
    "nearest.title.high-speed": {
        en: "Nearest high-speed line",
        de: "Nächste Schnellfahrstrecke",
    },
    "nearest.title.water": {
        en: "Nearest body of water",
        de: "Nächstes Gewässer",
    },
    "nearest.noun.amusement-park": {
        en: "amusement park",
        de: "Vergnügungspark",
    },
    "nearest.noun.zoo": { en: "zoo", de: "Zoo" },
    "nearest.noun.aquarium": { en: "aquarium", de: "Aquarium" },
    "nearest.noun.golf-course": { en: "golf course", de: "Golfplatz" },
    "nearest.noun.museum": { en: "museum", de: "Museum" },
    "nearest.noun.movie-theater": { en: "movie theater", de: "Kino" },
    "nearest.noun.hospital": { en: "hospital", de: "Krankenhaus" },
    "nearest.noun.library": { en: "library", de: "Bibliothek" },
    "nearest.noun.consulate": {
        en: "foreign consulate",
        de: "Konsulat",
    },
    "nearest.noun.mountain": { en: "mountain", de: "Berg" },
    "nearest.noun.park": { en: "park", de: "Park" },
    "nearest.noun.station": { en: "station", de: "Station" },
    "nearest.noun.street": { en: "path", de: "Weg" },
    "nearest.noun.high-speed": {
        en: "high-speed line",
        de: "Schnellfahrstrecke",
    },
    "nearest.noun.water": { en: "body of water", de: "Gewässer" },

    // Why the hider's answer is what it is
    "reason.radar": {
        en: "You are {distance} from where the seekers asked.",
        de: "Du bist {distance} von dem Ort entfernt, an dem die Seeker gefragt haben.",
    },
    "reason.thermometer": {
        en: "You are {start} from where the seekers started and {end} from where they stopped.",
        de: "Du bist {start} vom Start der Seeker entfernt und {end} von ihrem Ende.",
    },
    "reason.inside": {
        en: "You are {you}, the seekers are {them}.",
        de: "Du bist {you}, die Seeker sind {them}.",
    },
    "reason.elevation": {
        en: "You are {you} m above sea level, the seekers {them} m.",
        de: "Du bist auf {you} m Seehöhe, die Seeker auf {them} m.",
    },
    "reason.distance": {
        en: "{nearest} to you: {you}, {youDistance} away. To the seekers: {them}, {themDistance}.",
        de: "{nearest} bei dir: {you}, {youDistance} entfernt. Bei den Seekern: {them}, {themDistance}.",
    },
} satisfies Record<string, Text>;

export type MessageKey = keyof typeof messages;
