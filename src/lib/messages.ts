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
    "zones.overlap": { en: "{n} of {count}", de: "{n} von {count}" },
    "zones.nextHere": {
        en: "Next zone here (or tap the same spot again)",
        de: "Nächste Zone hier (oder nochmal auf dieselbe Stelle tippen)",
    },
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

    // Places and lines on the map: the button below the location button
    "layers.button": {
        en: "Places and lines on the map",
        de: "Orte und Linien auf der Karte",
    },
    "layers.title": { en: "Show on the map", de: "Auf der Karte zeigen" },
    "layers.hint": {
        en: "What the question cards ask about. Tap a symbol or a line to see its name.",
        de: "Wonach die Fragekarten fragen. Tippe auf ein Symbol oder eine Linie, um den Namen zu sehen.",
    },
    "layers.hideAll": { en: "Hide all", de: "Alle ausblenden" },
    "layers.zoomIn": {
        en: "Zoom in to see: {what}",
        de: "Zum Anzeigen hineinzoomen: {what}",
    },
    "layers.uBahn": { en: "U-Bahn lines", de: "U-Bahn-Linien" },
    "layers.sBahn": { en: "S-Bahn lines", de: "S-Bahn-Linien" },
    "layers.tram": { en: "Tram lines", de: "Straßenbahnlinien" },
    "layers.line.tram": { en: "Tram", de: "Straßenbahn" },
    "layers.line.count": { en: "{n} of {total}", de: "{n} von {total}" },
    "layers.line.towards": { en: "towards {name}", de: "Richtung {name}" },
    "layers.line.nextTitle": {
        en: "Next line here",
        de: "Nächste Linie hier",
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
    "ask.pending.one": {
        en: "Still waiting for the answer to {title}.",
        de: "Die Antwort auf {title} fehlt noch.",
    },
    "ask.pending.many": {
        en: "{count} questions are still waiting for an answer.",
        de: "{count} Fragen warten noch auf eine Antwort.",
    },
    "ask.pending.rule": {
        en: "By the rules, the next question comes after the answer. If the hider already answered in the chat, enter the answer first.",
        de: "Laut Regeln kommt die nächste Frage erst nach der Antwort. Hat der Hider schon im Chat geantwortet, trag die Antwort zuerst ein.",
    },
    "ask.pending.enter": { en: "Enter answer", de: "Antwort eintragen" },
    "ask.pending.anyway": { en: "Ask anyway", de: "Trotzdem fragen" },
    "ask.asked": {
        en: "Already asked at {time}: again costs double",
        de: "Schon gefragt um {time}: nochmal kostet doppelt",
    },
    "ask.askedMany": {
        en: "Already asked {count} times, last at {time}: again costs {times} times as much",
        de: "Schon {count}-mal gefragt, zuletzt um {time}: nochmal kostet {times}-fach",
    },
    "ask.askedShort": {
        en: "asked {time} · ×{times}",
        de: "gefragt {time} · ×{times}",
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
        en: 'Starts at your current location. Tell the hider, then travel at least the distance; the app shows it as the crow flies. Tap "Set end here" when you are far enough, then send the question.',
        de: "Startet an deinem aktuellen Standort. Gib dem Hider Bescheid, dann fahr mindestens die Strecke; die App zeigt sie in Luftlinie. Tippe auf „Ende hier setzen“, wenn du weit genug bist, dann schick die Frage.",
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
    "thermometer.tellHider": {
        en: "Tell the hider",
        de: "Hider Bescheid geben",
    },
    "thermometer.tellMessage": {
        en: "Thermometer {distance}: we're starting now ({time}). Our location: {link}",
        de: "Thermometer {distance}: Wir starten jetzt ({time}). Unser Standort: {link}",
    },
    "thermometer.told": {
        en: "Hider told at {time}",
        de: "Hider um {time} Bescheid gegeben",
    },
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
    "card.rules": {
        en: "What counts for this question",
        de: "Was bei dieser Frage zählt",
    },
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
        en: "Loading lines at {station} and where you are...",
        de: "Lade die Linien bei {station} und dort, wo ihr seid …",
    },
    "matching.line.failed": {
        en: "The lines at {station} and where you are didn't load.",
        de: "Die Linien bei {station} und dort, wo ihr seid, haben nicht geladen.",
    },
    "matching.line.none": {
        en: "No lines found at {station} or where you are.",
        de: "Weder bei {station} noch dort, wo ihr seid, wurden Linien gefunden.",
    },
    "matching.line.select": { en: "Seekers' line", de: "Linie der Seeker" },
    "matching.line.tram": { en: "Tram {ref}", de: "Straßenbahn {ref}" },
    "matching.line.bus": { en: "Bus {ref}", de: "Bus {ref}" },
    "matching.line.trolleybus": {
        en: "Trolleybus {ref}",
        de: "Oberleitungsbus {ref}",
    },
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
    "thermometer.traveled": {
        en: "Traveled {traveled} as the crow flies (card: {distance})",
        de: "Gefahren: {traveled} Luftlinie (Karte: {distance})",
    },
    "thermometer.traveledOnly": {
        en: "Traveled {traveled} as the crow flies",
        de: "Gefahren: {traveled} Luftlinie",
    },
    "thermometer.tooShortNote": {
        en: "Shorter than the card: the seekers must travel at least {distance}.",
        de: "Kürzer als die Karte: Die Seeker müssen mindestens {distance} fahren.",
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
    "reason.border": {
        en: "Nearest {border}: {you} from you, {them} from the seekers.",
        de: "Nächste {border}: {you} von dir, {them} von den Seekern.",
    },
    "reason.station": {
        en: "Your station is the one of your zone: {you}. The seekers' nearest station: {them}, {themDistance} away.",
        de: "Deine Station ist die deiner Zone: {you}. Nächste Station der Seeker: {them}, {themDistance} entfernt.",
    },

    // Your role on this phone
    "role.label": {
        en: "Your role on this phone",
        de: "Deine Rolle auf diesem Handy",
    },
    "role.seeking": { en: "I'm seeking", de: "Ich suche" },
    "role.hiding": { en: "I'm hiding", de: "Ich verstecke mich" },

    // Settings
    "settings.title": { en: "Settings", de: "Einstellungen" },
    "settings.share": { en: "Share game", de: "Spiel teilen" },
    "settings.help": { en: "Help", de: "Hilfe" },
    "settings.deleteAll": {
        en: "Delete all questions",
        de: "Alle Fragen löschen",
    },
    "settings.deleteAllTitle": {
        en: "Delete all questions?",
        de: "Alle Fragen löschen?",
    },
    "settings.deleteAllText": {
        en: "All {count} questions disappear from the map. You can undo this right afterwards.",
        de: "Alle {count} Fragen verschwinden von der Karte. Du kannst das gleich danach rückgängig machen.",
    },
    "settings.deleteAllButton": { en: "Delete all", de: "Alle löschen" },
    "settings.advanced": { en: "Advanced", de: "Erweitert" },
    "settings.mapData": { en: "Map data", de: "Kartendaten" },
    "settings.overpassAccess": {
        en: "Own Overpass access (optional)",
        de: "Eigener Overpass-Zugang (optional)",
    },
    "settings.overpassHint": {
        en: "Optional: your own server for map data, with your key in the address (e.g. overpass.ch). The app asks it first, then the public servers. You can also paste a setup link here.",
        de: "Optional: dein eigener Server für Kartendaten, mit deinem Key in der Adresse (z. B. overpass.ch). Die App fragt ihn zuerst, danach die öffentlichen Server. Hier kannst du auch einen Einrichtungs-Link einfügen.",
    },
    "settings.setupOthers": {
        en: "Set up other phones",
        de: "Andere Handys einrichten",
    },
    "overpass.saved": {
        en: "Overpass access saved on this phone.",
        de: "Overpass-Zugang auf diesem Handy gespeichert.",
    },
    "overpass.setupText": {
        en: "Scan the code with the camera of the other phone, or send it the link. Opening it saves your Overpass access on that phone.",
        de: "Scanne den Code mit der Kamera des anderen Handys oder schick den Link hin. Beim Öffnen wird dein Overpass-Zugang dort gespeichert.",
    },
    "overpass.shareLink": { en: "Share link", de: "Link teilen" },
    "overpass.copyLink": { en: "Copy link", de: "Link kopieren" },
    "overpass.linkCopied": { en: "Link copied.", de: "Link kopiert." },
    "overpass.warning": {
        en: "Anyone with this link can use your access. Only send it to your players.",
        de: "Wer den Link hat, kann deinen Zugang nutzen. Schick ihn nur an deine Mitspieler.",
    },
    "overpass.iphoneHint": {
        en: "iPhone with the app on the home screen: the link opens in Safari, not in the app. Copy the link instead and paste it in the app under Settings → Advanced → Overpass access.",
        de: "iPhone mit der App auf dem Home-Bildschirm: Der Link öffnet sich in Safari, nicht in der App. Dann den Link kopieren und in der App unter Einstellungen → Erweitert → Overpass-Zugang einfügen.",
    },
    "settings.preload": { en: "Preload map data", de: "Kartendaten vorladen" },
    "settings.preloadHint": {
        en: 'Loads the data of every question card for the game area, so answers don\'t have to wait. "New Game" does this by itself.',
        de: "Lädt die Daten aller Fragekarten für das Spielgebiet, damit Antworten nicht warten müssen. „Neues Spiel“ macht das von selbst.",
    },
    "settings.mapStyle": { en: "Map style", de: "Kartenstil" },
    "settings.style.standard": { en: "Standard", de: "Standard" },
    "settings.style.light": { en: "Light", de: "Hell" },
    "settings.style.dark": { en: "Dark", de: "Dunkel" },
    "settings.questions": { en: "Questions", de: "Fragen" },
    "settings.allTypes": {
        en: "Show all question types?",
        de: "Alle Fragearten zeigen?",
    },
    "settings.allTypesHint": {
        en: "For experts: question cards also offer tentacles and the variants that are not part of the Small deck.",
        de: "Für Profis: Die Fragekarten bieten auch Tentakel und die Varianten, die nicht im Small-Deck sind.",
    },
    "settings.gameFile": { en: "Game file", de: "Spieldatei" },
    "settings.saveFile": { en: "Save file", de: "Datei speichern" },
    "settings.loadFile": { en: "Load file", de: "Datei laden" },
    "settings.gameFileHint": {
        en: "Saves the game area, questions and ruled-out zones in a file, or loads such a file.",
        de: "Speichert Spielgebiet, Fragen und gestrichene Zonen in einer Datei oder lädt so eine Datei.",
    },
    "settings.gameArea": { en: "Game area", de: "Spielgebiet" },
    "settings.drawingTools": {
        en: "Show drawing tools?",
        de: "Zeichenwerkzeuge zeigen?",
    },
    "settings.drawingHint": {
        en: "Draw the game area by hand (top left of the map).",
        de: "Spielgebiet von Hand zeichnen (oben links auf der Karte).",
    },
    "settings.hidingZones": { en: "Hiding zones", de: "Zonen" },
    "settings.about": { en: "About", de: "Über die App" },

    // Settings → About: where the map data and tools come from (the map
    // itself shows no credits)
    "credits.osm": {
        en: "OpenStreetMap contributors",
        de: "OpenStreetMap-Mitwirkende",
    },
    "credits.esri": { en: "Powered by Esri", de: "Powered by Esri" },
    "about.title": {
        en: "About Hide & Seek Vienna",
        de: "Über Hide & Seek Vienna",
    },
    "about.intro": {
        en: "The map for our Hide & Seek games in Vienna. Map data and tools come from:",
        de: "Die Karte für unsere Hide-&-Seek-Spiele in Wien. Kartendaten und Werkzeuge kommen von:",
    },
    "about.mapData": { en: "Map data", de: "Kartendaten" },
    "about.osmLicence": {
        en: "Available under the Open Database License (ODbL)",
        de: "Verfügbar unter der Open Database License (ODbL)",
    },
    "about.mapImages": { en: "Map images", de: "Kartenbilder" },
    "about.calculations": {
        en: "Distances and areas",
        de: "Entfernungen und Flächen",
    },
    "about.elevation": { en: "Elevation", de: "Seehöhe" },
    "about.elevationSource": {
        en: "Terrain Tiles (Mapzen, AWS Open Data)",
        de: "Terrain Tiles (Mapzen, AWS Open Data)",
    },
    "about.elevationAustria": {
        en: "Austria: © offene Daten Österreichs – Digitales Geländemodell (DGM) Österreich, CC BY 3.0 AT",
        de: "Österreich: © offene Daten Österreichs – Digitales Geländemodell (DGM) Österreich, CC BY 3.0 AT",
    },
    "about.software": { en: "Software", de: "Software" },
    "about.softwareText": {
        en: "Made with Leaflet, Turf.js, React, Lucide and other open-source libraries.",
        de: "Gebaut mit Leaflet, Turf.js, React, Lucide und anderen Open-Source-Bibliotheken.",
    },

    // Loading and sharing a game
    "game.loaded": { en: "Game loaded", de: "Spiel geladen" },
    "game.invalid": {
        en: "This game can't be loaded: {error}",
        de: "Dieses Spiel lässt sich nicht laden: {error}",
    },
    "game.loadedFrom": {
        en: "Game loaded from {source}",
        de: "Spiel von {source} geladen",
    },
    "game.loadFailed": {
        en: "Couldn't load the game from {source}: {error}",
        de: "Das Spiel ließ sich nicht von {source} laden: {error}",
    },
    "game.presetName": { en: "Imported preset", de: "Importierte Vorlage" },
    "game.presetsImported": {
        en: "Imported {count} preset(s)",
        de: "{count} Vorlage(n) importiert",
    },
    "game.saved": {
        en: "Game saved to a file",
        de: "Spiel als Datei gespeichert",
    },
    "game.saveFailed": {
        en: "Couldn't save the file: {error}",
        de: "Die Datei ließ sich nicht speichern: {error}",
    },
    "game.readFailed": {
        en: "Couldn't read the file",
        de: "Die Datei ließ sich nicht lesen",
    },
    "game.shareFailed": {
        en: "Couldn't prepare the game for sharing",
        de: "Das Spiel ließ sich nicht zum Teilen vorbereiten",
    },
    "game.tooLarge": {
        en: "The game is too large for a link, saving a file instead.",
        de: "Das Spiel ist zu groß für einen Link, es wird stattdessen als Datei gespeichert.",
    },
    "game.copyByHand": {
        en: "Couldn't copy the link. Copy it by hand: {link}",
        de: "Der Link ließ sich nicht kopieren. Kopiere ihn von Hand: {link}",
    },
    "game.linkCopied": {
        en: "Link to the game copied",
        de: "Link zum Spiel kopiert",
    },

    // "New Game"
    "newGame.button": { en: "New Game", de: "Neues Spiel" },
    "newGame.hint": {
        en: "Vienna, Small game: U-Bahn stations only, 500 m",
        de: "Wien, Small: nur U-Bahn-Stationen, 500 m",
    },
    "newGame.title": {
        en: "Start a new game (Vienna, Small)?",
        de: "Neues Spiel starten (Wien, Small)?",
    },
    "newGame.text": {
        en: "The game area is Vienna. Hiding zones are all U-Bahn stations with a 500 m radius. While the hider hides, the app loads the map data for every question card.",
        de: "Gespielt wird in Wien. Die Zonen sind alle U-Bahn-Stationen mit 500 m Radius. Während sich der Hider versteckt, lädt die App die Kartendaten für alle Fragekarten.",
    },
    "newGame.deletesOne": {
        en: "The question disappears; you can undo this right afterwards.",
        de: "Die Frage verschwindet; du kannst das gleich danach rückgängig machen.",
    },
    "newGame.deletesMany": {
        en: "All {count} questions disappear; you can undo this right afterwards.",
        de: "Alle {count} Fragen verschwinden; du kannst das gleich danach rückgängig machen.",
    },

    // Messages with "Undo"
    "undo.button": { en: "Undo", de: "Rückgängig" },
    "undo.questionDeleted": { en: "Question deleted", de: "Frage gelöscht" },
    "undo.questionsDeleted": {
        en: "{count} questions deleted",
        de: "{count} Fragen gelöscht",
    },
    "undo.onlyLeft": {
        en: "Only {name} is left, {ruledOut} ruled out",
        de: "Nur noch {name} übrig, {ruledOut} gestrichen",
    },
    "undo.kept": {
        en: "{count} zones kept, {ruledOut} ruled out",
        de: "{count} Zonen behalten, {ruledOut} gestrichen",
    },

    // The zone list
    "zones.title": { en: "Hiding zones", de: "Zonen" },
    "zones.settings": { en: "Settings", de: "Einstellungen" },
    "zones.settingsTitle": { en: "Zone settings", de: "Zonen-Einstellungen" },
    "zones.settingsText": {
        en: "Which stations count as hiding zones, and how big they are.",
        de: "Welche Stationen als Zonen zählen und wie groß die Zonen sind.",
    },
    "zones.off": {
        en: "Hiding zones are turned off.",
        de: "Die Zonen sind ausgeschaltet.",
    },
    "zones.turnOn": { en: "Show hiding zones", de: "Zonen zeigen" },
    "zones.style.zones": { en: "Zones", de: "Zonen" },
    "zones.style.stations": { en: "Stations", de: "Stationen" },
    "zones.style.merged": { en: "Merged", de: "Vereint" },
    "zones.style.hidden": { en: "Hidden", de: "Aus" },
    "zones.keepHelp": {
        en: "Tick the zones the hider can still be in, e.g. after a photo. All other zones are ruled out.",
        de: "Hake die Zonen an, in denen der Hider noch sein kann, z. B. nach einem Foto. Alle anderen Zonen werden gestrichen.",
    },
    "zones.listHelp": {
        en: "Tap a zone to see it on the map. Swipe it sideways to rule it out, or back in.",
        de: "Tippe eine Zone an, um sie auf der Karte zu sehen. Wische sie zur Seite, um sie zu streichen oder zurückzuholen.",
    },
    "zones.search": { en: "Search for a station...", de: "Station suchen …" },
    "zones.keepOnly": { en: "Keep only...", de: "Nur behalten …" },
    "zones.notFound": {
        en: "No hiding zones found.",
        de: "Keine Zonen gefunden.",
    },
    "zones.finding": {
        en: "Finding the hiding zones...",
        de: "Suche die Zonen …",
    },
    "zones.noneLeft": {
        en: "No hiding zones left.",
        de: "Keine Zonen mehr übrig.",
    },
    "zones.keepThis": { en: "Keep this zone", de: "Diese Zone behalten" },
    "zones.keepThese": {
        en: "Keep these {count}",
        de: "Diese {count} behalten",
    },
    "zones.restoreAll": { en: "Restore all", de: "Alle zurückholen" },
    "zones.ruleOutAll": { en: "Rule out all", de: "Alle streichen" },
    "zones.display": { en: "Display hiding zones?", de: "Zonen anzeigen?" },
    "zones.slow": {
        en: "Hiding zones can slow down your phone.",
        de: "Die Zonen können das Handy langsamer machen.",
    },
    "zones.stations": { en: "Stations", de: "Stationen" },
    "zones.stationTypes": {
        en: "Select allowed places",
        de: "Arten von Stationen wählen",
    },
    "zones.ownList": {
        en: "This phone uses its own station list (Settings > Advanced).",
        de: "Dieses Handy nutzt eine eigene Stationsliste (Einstellungen > Erweitert).",
    },
    "zones.radius": { en: "Hiding zone radius", de: "Radius der Zonen" },
    "zones.noName": { en: "Station without a name", de: "Station ohne Namen" },

    // Kinds of stations for the hiding zones
    "stationType.railway": { en: "Railway Stations", de: "Bahnhöfe" },
    "stationType.halt": { en: "Railway Halts", de: "Haltepunkte" },
    "stationType.stop": { en: "Railway Stops", de: "Bahn-Haltestellen" },
    "stationType.tram": {
        en: "Tram Stops",
        de: "Straßenbahn-Haltestellen",
    },
    "stationType.bus": { en: "Bus Stops", de: "Bushaltestellen" },
    "stationType.ferry": { en: "Ferry Terminals", de: "Fährterminals" },
    "stationType.ferryPlatform": {
        en: "Ferry Platforms (public transport)",
        de: "Fähranleger (Öffis)",
    },
    "stationType.funicular": {
        en: "Funicular Stations",
        de: "Standseilbahn-Stationen",
    },
    "stationType.aerialway": {
        en: "Aerialway Stations",
        de: "Seilbahn-Stationen",
    },
    "stationType.noSubway": {
        en: "Railway Stations Excluding Subways",
        de: "Bahnhöfe ohne U-Bahn",
    },
    "stationType.subway": { en: "Subway Stations", de: "U-Bahn-Stationen" },
    "stationType.lightRail": {
        en: "Light Rail Stations",
        de: "Stadtbahn-Stationen",
    },
    "stationType.lightRailHalt": {
        en: "Light Rail Halts",
        de: "Stadtbahn-Haltepunkte",
    },

    // Own station list (Settings > Advanced)
    "stations.useOwn": {
        en: "Use custom station list?",
        de: "Eigene Stationsliste verwenden?",
    },
    "stations.importUrl": {
        en: "Import stations from URL (CSV, GeoJSON, KML). This must be a raw file link.",
        de: "Stationen von einer URL importieren (CSV, GeoJSON, KML). Das muss ein direkter Link auf die Datei sein.",
    },
    "stations.import": { en: "Import", de: "Importieren" },
    "stations.includeDefault": {
        en: "Include default stations with custom list?",
        de: "Normale Stationen zusätzlich verwenden?",
    },
    "stations.importedOne": {
        en: "1 custom station imported",
        de: "1 eigene Station importiert",
    },
    "stations.importedMany": {
        en: "{count} custom stations imported",
        de: "{count} eigene Stationen importiert",
    },
    "stations.clear": { en: "Clear imported", de: "Importierte löschen" },
    "stations.noneAtUrl": {
        en: "No stations found at this URL",
        de: "Unter dieser URL wurden keine Stationen gefunden",
    },
    "stations.noneInFiles": {
        en: "No stations found in the files",
        de: "In den Dateien wurden keine Stationen gefunden",
    },
    "stations.imported": {
        en: "Imported {count} stations",
        de: "{count} Stationen importiert",
    },
    "stations.urlFailed": {
        en: "Couldn't import from the URL: {error}",
        de: "Import von der URL fehlgeschlagen: {error}",
    },
    "stations.filesFailed": {
        en: "Couldn't import the files: {error}",
        de: "Import der Dateien fehlgeschlagen: {error}",
    },

    // The hider's screen
    "hider.map": { en: "Map", de: "Karte" },
    "hider.chooseHint": {
        en: "Tap a zone on the map to choose it.",
        de: "Tippe auf der Karte auf eine Zone, um sie zu wählen.",
    },
    "hider.poorGps": {
        en: "Your GPS is only accurate to ±{meters} m here.",
        de: "Dein GPS ist hier nur auf ±{meters} m genau.",
    },
    "hider.change": { en: "Change", de: "Wechseln" },
    "hider.choose": { en: "Choose {station}", de: "{station} wählen" },
    "hider.chooseAnother": {
        en: "Choose another zone on the map",
        de: "Andere Zone auf der Karte wählen",
    },
    "hider.chooseOnMap": {
        en: "Choose on the map",
        de: "Auf der Karte wählen",
    },
    "hider.forHider": {
        en: "This question is for the hider. This phone is set to seeking.",
        de: "Diese Frage ist für den Hider. Dieses Handy ist auf Suchen eingestellt.",
    },
    "hider.nowHider": {
        en: "This phone is now the hider's. You can change this in the settings.",
        de: "Dieses Handy gehört jetzt dem Hider. Du kannst das in den Einstellungen ändern.",
    },
    "hider.ownQuestion": {
        en: "This is your own question. Send the link to the hider: their phone works out the answer.",
        de: "Das ist deine eigene Frage. Schick den Link an den Hider: Das Handy des Hiders rechnet die Antwort aus.",
    },
    "hider.brokenLink": {
        en: "This question link is broken. Ask the seekers to send it again.",
        de: "Dieser Frage-Link ist kaputt. Bitte die Seeker, ihn nochmal zu schicken.",
    },
    "hider.locationFailed": {
        en: "Couldn't get your location. Allow location access for this site, or use the violet H marker on the map.",
        de: "Dein Standort ließ sich nicht bestimmen. Erlaube dieser Seite den Standortzugriff oder nimm die violette H-Nadel auf der Karte.",
    },
    "hider.locationGps": {
        en: "Your location: GPS, {time}, ±{meters} m",
        de: "Dein Standort: GPS, {time}, ±{meters} m",
    },
    "hider.locationMarker": {
        en: "Your location: the H marker on the map",
        de: "Dein Standort: die H-Nadel auf der Karte",
    },
    "hider.update": { en: "Update", de: "Aktualisieren" },
    "hider.useMarker": { en: "Use the H marker", de: "H-Nadel verwenden" },
    "hider.questionFromAt": {
        en: "Question from the seekers · asked {time}",
        de: "Frage der Seeker · gestellt um {time}",
    },
    "hider.waitingForLocation": {
        en: "Your answer appears once your location is known.",
        de: "Deine Antwort erscheint, sobald dein Standort bekannt ist.",
    },
    "hider.chooseZoneFirst": {
        en: "This question is about the station of your zone. Choose your zone above; until then the app takes the station nearest to you.",
        de: "Diese Frage gilt der Station deiner Zone. Wähle oben deine Zone; bis dahin nimmt die App die Station, die dir am nächsten ist.",
    },
    "hider.working": {
        en: "Working out your answer...",
        de: "Rechne deine Antwort aus …",
    },
    "hider.failed": {
        en: "Couldn't work out the answer: map data didn't load.",
        de: "Die Antwort ließ sich nicht ausrechnen: Die Kartendaten haben nicht geladen.",
    },
    "hider.tryAgain": { en: "Try again", de: "Nochmal versuchen" },
    "hider.yourAnswer": { en: "Your answer", de: "Deine Antwort" },
    "hider.noQuestion": {
        en: "No question yet. When the seekers send you a question link, open it on this phone: the question appears here with your answer and the time you have to answer.",
        de: "Noch keine Frage. Wenn dir die Seeker einen Frage-Link schicken, öffne ihn auf diesem Handy: Die Frage erscheint hier mit deiner Antwort und der Zeit, die du zum Antworten hast.",
    },
    "hider.noOpen": {
        en: "No open questions. New questions from the seekers appear here.",
        de: "Keine offenen Fragen. Neue Fragen der Seeker erscheinen hier.",
    },
    "hider.open": { en: "Also open", de: "Auch offen" },
    "hider.send": { en: "Send answer", de: "Antwort senden" },
    "hider.alreadyAnswered": {
        en: "Already answered",
        de: "Schon beantwortet",
    },
    "hider.sendHint": {
        en: '"Send answer" shares only the answer, e.g. in your WhatsApp group. The reason above is for you.',
        de: "„Antwort senden“ teilt nur die Antwort, etwa in eurer WhatsApp-Gruppe. Der Grund oben ist nur für dich.",
    },
    "hider.answerMessage": {
        en: "{title} – answer: {answer}",
        de: "{title} – Antwort: {answer}",
    },
    "hider.answerCopied": {
        en: "Answer copied. Paste it into your chat with the seekers.",
        de: "Antwort kopiert. Füge sie in den Chat mit den Seekern ein.",
    },
    "hider.shareFailed": {
        en: "Couldn't share. Send the seekers: {message}",
        de: "Teilen hat nicht geklappt. Schick den Seekern: {message}",
    },
    "hider.answered": { en: "Answered", de: "Beantwortet" },
    "hider.answeredAt": {
        en: "You answered at {time}",
        de: "Du hast um {time} geantwortet",
    },
    "hider.onMap": {
        en: "Your map now shows what this answer rules out.",
        de: "Deine Karte zeigt jetzt, was diese Antwort ausschließt.",
    },
    "hider.sendAgain": { en: "Send again", de: "Nochmal senden" },
    "hider.reopen": { en: "Reopen", de: "Wieder öffnen" },
    "hider.photoNote": {
        en: "Take the photo and send it in your chat, in your phone's normal aspect ratio.",
        de: "Mach das Foto und schick es in den Chat, im normalen Seitenverhältnis deines Handys.",
    },
    "hider.cantAnswer": {
        en: "Can't answer (not in my zone)",
        de: "Keine Antwort (nicht in meiner Zone)",
    },
    "hider.chatNote": {
        en: "Answer in your chat. Without the link, the app can't work out the answer or show it on your map.",
        de: "Antworte im Chat. Ohne den Link kann die App die Antwort nicht ausrechnen und nicht auf deiner Karte zeigen.",
    },
    "hider.addedAt": {
        en: "Added by you · {time}",
        de: "Von dir eingetragen · {time}",
    },
    "hider.paste": {
        en: "Paste question link",
        de: "Frage-Link einfügen",
    },
    "hider.pasteHelp": {
        en: "Press and hold the link in the chat, copy it, and paste it here.",
        de: "Drück im Chat lange auf den Link, kopiere ihn und füge ihn hier ein.",
    },
    "hider.pastePlaceholder": {
        en: "Question link",
        de: "Frage-Link",
    },
    "hider.pasteNoLink": {
        en: "That's not a question link.",
        de: "Das ist kein Frage-Link.",
    },
    "hider.inBrowserTitle": {
        en: "Is the app on your home screen?",
        de: "Ist die App auf deinem Home-Bildschirm?",
    },
    "hider.inBrowser": {
        en: "On the iPhone, links open in Safari, and Safari keeps its own copy of the app: without your zone, the timer and your earlier answers. Answer in the app instead: press and hold the link in the chat, copy it, open the app and tap “{paste}” on the hider screen.",
        de: "Auf dem iPhone öffnen sich Links in Safari, und Safari hat eine eigene Kopie der App: ohne deine Zone, die Uhr und deine früheren Antworten. Antworte lieber in der App: Drück im Chat lange auf den Link, kopiere ihn, öffne die App und tippe auf dem Hider-Bildschirm auf „{paste}“.",
    },
    "hider.add": {
        en: "Add a question by hand",
        de: "Frage von Hand eintragen",
    },
    "hider.addHelp": {
        en: "For questions that didn't come as a link: photos, or a question asked in the chat. The clock starts now.",
        de: "Für Fragen, die nicht als Link kamen: Fotos oder eine Frage im Chat. Die Uhr läuft ab jetzt.",
    },
    "hider.addChat": { en: "Asked in the chat", de: "Im Chat gefragt" },

    // The time the hider has to answer
    "clock.left": {
        en: "Answer due {time} · {left} left",
        de: "Antwort bis {time} · noch {left}",
    },
    "clock.late": {
        en: "Answer was due {time} · {late} late",
        de: "Antwort war bis {time} fällig · {late} zu spät",
    },
    "clock.lateLong": {
        en: "Answer was due {time}",
        de: "Antwort war bis {time} fällig",
    },
    "clock.notSent": {
        en: "The hider's {minutes} minutes start when you send the question.",
        de: "Die {minutes} Minuten des Hiders laufen ab dem Senden der Frage.",
    },

    // The game timer
    "gameClock.title": { en: "Game timer", de: "Spielzeit" },
    "gameClock.start": { en: "Start timer", de: "Timer starten" },
    "gameClock.startHint": {
        en: "Start it when the hiding period begins: {minutes} minutes to reach the hiding zone, then the hiding time runs until the hider is found.",
        de: "Starte ihn, wenn die Versteckphase beginnt: {minutes} Minuten, um in die Zone zu kommen, danach läuft die Versteckzeit, bis der Hider gefunden ist.",
    },
    "gameClock.hidingPeriod": {
        en: "Hiding period · {left} left",
        de: "Versteckphase · noch {left}",
    },
    "gameClock.chipHiding": {
        en: "Hiding period {left}",
        de: "Versteckphase {left}",
    },
    "gameClock.seekersStart": {
        en: "The seekers start at {time}",
        de: "Die Seeker starten um {time}",
    },
    "gameClock.hidingTime": { en: "Hiding time", de: "Versteckzeit" },
    "gameClock.since": { en: "Since {time}", de: "Seit {time}" },
    "gameClock.paused": { en: "Paused", de: "Pausiert" },
    "gameClock.pause": { en: "Pause", de: "Pause" },
    "gameClock.resume": { en: "Resume", de: "Weiter" },
    "gameClock.pauseHint": {
        en: "Pause while the hiding time doesn't count: a late answer, the Move card.",
        de: "Pause, solange die Versteckzeit nicht zählt: bei einer zu späten Antwort oder der Karte Move.",
    },
    "gameClock.late": {
        en: "Stopped: answer late",
        de: "Steht: Antwort zu spät",
    },
    "gameClock.pauseHintMove": {
        en: "Late answers stop the hiding time by themselves, until the answer is sent. Pause for the Move card.",
        de: "Zu späte Antworten halten die Versteckzeit von selbst an, bis die Antwort gesendet ist. Pause bei der Karte Move.",
    },
    "settings.gameClock": { en: "Game timer", de: "Spielzeit" },
    "settings.lateAnswers": {
        en: "Late answers stop the hiding time",
        de: "Zu späte Antworten halten die Versteckzeit an",
    },
    "settings.lateAnswersHint": {
        en: "On the hider's phone: from when the answer was due until it was sent. Off: tap Pause and Resume on the timer yourself.",
        de: "Auf dem Handy des Hiders: von der Frist, bis die Antwort gesendet ist. Aus: Pause und Weiter auf der Uhr selbst tippen.",
    },
    "hider.draw": {
        en: "Now draw {draw} cards and keep {keep}.",
        de: "Jetzt {draw} Karten ziehen und {keep} behalten.",
    },
    "hider.drawOne": {
        en: "Now draw 1 card and keep it.",
        de: "Jetzt 1 Karte ziehen und behalten.",
    },
    "hider.drawRepeat": {
        en: "Asked before, so draw {times} times: {draw} cards each time, keep {keep} each time.",
        de: "Schon einmal gefragt, also {times}-mal ziehen: je {draw} Karten, je {keep} behalten.",
    },
    "hider.drawOneRepeat": {
        en: "Asked before, so draw {times} times: 1 card each time, and keep it.",
        de: "Schon einmal gefragt, also {times}-mal ziehen: je 1 Karte, und behalten.",
    },
    "hider.drawLate": {
        en: "Answered late: no cards for this question.",
        de: "Zu spät geantwortet: Für diese Frage gibt es keine Karten.",
    },
    "move.button": {
        en: "Hider moved (Move card)",
        de: "Hider ist umgezogen (Karte Move)",
    },
    "move.title": {
        en: "Did the hider play Move?",
        de: "Hat der Hider Move gespielt?",
    },
    "move.text": {
        en: "The answers so far were about the old zone: they stop counting on the map (they stay in the list), and all zones come back. The new zone is at another station, so rule out the old one: tap its zone on the map, then “{ruleOut}”. Your game timer pauses; tap “{resume}” when the move time is over.",
        de: "Die bisherigen Antworten galten für die alte Zone: Sie zählen auf der Karte nicht mehr (bleiben aber in der Liste), und alle Zonen sind wieder da. Die neue Zone liegt an einer anderen Station, also streicht die alte: auf der Karte antippen, dann „{ruleOut}“. Eure Spielzeit pausiert; tippt „{resume}“, wenn die Zeit für den Umzug um ist.",
    },
    "move.confirm": { en: "Hider moved", de: "Umgezogen" },
    "move.done": {
        en: "Earlier answers hidden, all zones are back.",
        de: "Frühere Antworten ausgeblendet, alle Zonen sind wieder da.",
    },
    "move.hiderButton": {
        en: "I'm moving (Move card)",
        de: "Ich ziehe um (Karte Move)",
    },
    "move.hiderTitle": { en: "Play Move?", de: "Move spielen?" },
    "move.hiderText": {
        en: "Discard your whole hand and tell the seekers your old station. Your zone is cleared: choose the new one, at another station, once you're there. The game timer pauses; tap “{resume}” when the move time on the card is over.",
        de: "Leg alle Karten auf der Hand ab und sag den Seekern deine bisherige Station. Deine Zone ist dann frei: Wähl die neue an einer anderen Station, sobald du dort bist. Die Spielzeit pausiert; tippe „{resume}“, wenn die Zeit auf der Karte um ist.",
    },
    "move.hiderConfirm": { en: "Play Move", de: "Move spielen" },
    "move.hiderDone": {
        en: "Moving: choose your new zone once you're there.",
        de: "Umzug: Wähl deine neue Zone, sobald du dort bist.",
    },
    "gameClock.found": { en: "Found", de: "Gefunden" },
    "gameClock.foundAfter": {
        en: "Found after {time}",
        de: "Gefunden nach {time}",
    },
    "gameClock.bonusHint": {
        en: "Add the time bonus cards the hider still has in hand.",
        de: "Dazu kommen die Zeitbonus-Karten, die der Hider noch auf der Hand hat.",
    },
    "gameClock.notFound": { en: "Not found yet", de: "Doch nicht gefunden" },
    "gameClock.reset": { en: "Reset timer", de: "Timer zurücksetzen" },
    "gameClock.resetConfirm": {
        en: "Reset the game timer?",
        de: "Spielzeit zurücksetzen?",
    },

    // Photo questions
    "photo.kind": { en: "Photo", de: "Foto" },
    "photo.question": {
        en: "Send me a photo of …",
        de: "Schick mir ein Foto von …",
    },
    "photo.help": {
        en: "The hider has 10 minutes. The photo comes in your chat; the app keeps the question and the clock. Photos don't change the map.",
        de: "Der Hider hat 10 Minuten. Das Foto kommt im Chat, die App merkt sich Frage und Uhr. Fotos verändern die Karte nicht.",
    },
    "photo.title": { en: "Photo: {photo}", de: "Foto: {photo}" },
    "photo.sent": { en: "Photo sent", de: "Foto geschickt" },
    "photo.received": { en: "Photo received", de: "Foto erhalten" },
    "photo.waiting": {
        en: "Waiting for the hider's photo",
        de: "Wartet auf das Foto des Hiders",
    },
    "photo.notOnMap": {
        en: "Photos don't change the map: rule out zones yourself (Zones).",
        de: "Fotos verändern die Karte nicht: Zonen selbst streichen (Zonen).",
    },
    "photo.sendMessage": {
        en: "Question for the hider: {title}\nOpen this link for your time to answer: {link}",
        de: "Frage an den Hider: {title}\nÖffne diesen Link für deine Zeit zum Antworten: {link}",
    },

    // The hider's hiding zone
    "check.choose": { en: "Choose your hiding zone", de: "Wähle deine Zone" },
    "check.inZone": {
        en: "You are in the {station} zone, {distance} from the station",
        de: "Du bist in der Zone {station}, {distance} von der Station",
    },
    "check.nearest": {
        en: "Nearest: the {station} zone, {distance} away",
        de: "Am nächsten: die Zone {station}, {distance} entfernt",
    },
    "check.yours": { en: "Your zone: {station}", de: "Deine Zone: {station}" },
    "check.fromStation": {
        en: "{distance} from the station",
        de: "{distance} von der Station",
    },
    "check.outside": {
        en: "Outside your hiding zone",
        de: "Außerhalb deiner Zone",
    },
    "check.toZone": {
        en: "{distance} to the {station} zone",
        de: "{distance} bis zur Zone {station}",
    },

    // Waiting for a precise location
    "locating.waiting": {
        en: "Getting your location...",
        de: "Suche deinen Standort …",
    },
    "locating.accuracy": {
        en: "Getting your location · ±{meters} m",
        de: "Suche deinen Standort · ±{meters} m",
    },
    "locating.useAnyway": { en: "Use anyway", de: "Trotzdem nehmen" },
    "locating.mapCenter": {
        en: 'Couldn\'t get your location. The question starts at the map center; move it with "Pick on map".',
        de: "Dein Standort ließ sich nicht bestimmen. Die Frage startet in der Kartenmitte; verschiebe sie mit „Auf Karte wählen“.",
    },

    // The loading box at the top of the map
    "loading.updating": {
        en: "Updating the map...",
        de: "Karte wird aktualisiert …",
    },
    "loading.gameReady": {
        en: "Map data for the game is ready",
        de: "Kartendaten für das Spiel sind bereit",
    },
    "loading.game": {
        en: "Loading map data for the game",
        de: "Lade Kartendaten für das Spiel",
    },
    "loading.mapData": { en: "Loading map data...", de: "Lade Kartendaten …" },
    "loading.failed": {
        en: "Map data didn't load ({what}). {reason}",
        de: "Kartendaten haben nicht geladen ({what}). {reason}",
    },
    "loading.retry": { en: "Retry", de: "Nochmal" },
    "loading.timeout": {
        en: "The map servers didn't answer in time.",
        de: "Die Kartenserver haben nicht rechtzeitig geantwortet.",
    },
    "loading.status": {
        en: 'The map server answered "{status}".',
        de: "Der Kartenserver hat mit „{status}“ geantwortet.",
    },
    "loading.unreachable": {
        en: "The map servers couldn't be reached.",
        de: "Die Kartenserver waren nicht erreichbar.",
    },
    "loading.gaveUp": {
        en: "The map server gave up on the request.",
        de: "Der Kartenserver hat die Anfrage abgebrochen.",
    },
    "loading.tentacles": {
        en: "Finding tentacle locations...",
        de: "Suche Tentakel-Orte …",
    },
    "loading.zone": { en: "Finding the zone...", de: "Suche das Gebiet …" },
    "loading.coastline": {
        en: "Loading coastline data...",
        de: "Lade Küstenlinien …",
    },
    "loading.lines": { en: "Finding train lines...", de: "Suche Linien …" },
    "loading.transitLines": {
        en: "Finding U-Bahn and S-Bahn lines...",
        de: "Suche U-Bahn- und S-Bahn-Linien …",
    },
    "loading.tramLines": {
        en: "Finding tram lines...",
        de: "Suche Straßenbahnlinien …",
    },
    "loading.street": {
        en: "Finding nearest street...",
        de: "Suche die nächste Straße …",
    },
    "loading.named": { en: "Finding {name}...", de: "Suche {name} …" },
    "loading.water": {
        en: "Finding bodies of water...",
        de: "Suche Gewässer …",
    },
    "loading.islands": { en: "Finding islands...", de: "Suche Inseln …" },
    "loading.checkIslands": {
        en: "Checking islands...",
        de: "Prüfe Inseln …",
    },
    "loading.places": { en: "Finding {what}...", de: "Suche {what} …" },
    "loading.highSpeed": {
        en: "Finding high-speed lines...",
        de: "Suche Schnellfahrstrecken …",
    },
    "loading.matchingPlaces": {
        en: "Finding matching locations...",
        de: "Suche passende Orte …",
    },
    "loading.zonePlaces": {
        en: "Finding matching locations to hiding zone...",
        de: "Suche passende Orte zur Zone …",
    },
    "loading.airports": { en: "Finding airports...", de: "Suche Flughäfen …" },
    "loading.cities": { en: "Finding cities...", de: "Suche Großstädte …" },
    "loading.letterZones": {
        en: "Finding zones that start with the same letter ({letter})...",
        de: "Suche Gebiete mit demselben Anfangsbuchstaben ({letter}) …",
    },
    "loading.stations": { en: "Finding stations...", de: "Suche Stationen …" },
    "loading.elevation": {
        en: "Loading elevation data...",
        de: "Lade Höhendaten …",
    },

    // Kinds of places, as they appear in a sentence
    "places.aquarium": { en: "aquariums", de: "Aquarien" },
    "places.zoo": { en: "zoos", de: "Zoos" },
    "places.theme_park": { en: "theme parks", de: "Vergnügungsparks" },
    "places.peak": { en: "mountains", de: "Berge" },
    "places.museum": { en: "museums", de: "Museen" },
    "places.hospital": { en: "hospitals", de: "Krankenhäuser" },
    "places.cinema": { en: "cinemas", de: "Kinos" },
    "places.library": { en: "libraries", de: "Bibliotheken" },
    "places.golf_course": { en: "golf courses", de: "Golfplätze" },
    "places.consulate": { en: "foreign consulates", de: "Konsulate" },
    "places.park": { en: "parks", de: "Parks" },
    "places.airports": { en: "commercial airports", de: "Verkehrsflughäfen" },
    "places.cities": { en: "major cities", de: "Großstädte" },
    "places.stations": { en: "train stations", de: "Stationen" },
    "places.mcdonalds": { en: "McDonald's", de: "McDonald's" },
    "places.seven11": { en: "7-Elevens", de: "7-Eleven" },
    "places.none": {
        en: "No {what} inside the game area. By the rules the question has no answer, but it still counts.",
        de: "Keine {what} im Spielgebiet. Laut Regeln hat die Frage keine Antwort, sie zählt aber trotzdem.",
    },
    "places.tooMany": {
        en: "Too many {what} found ({count}). Please turn on hiding zones and choose the hiding zone mode of this question.",
        de: "Zu viele {what} gefunden ({count}). Schalte die Zonen ein und wähle diese Frage im Zonen-Modus.",
    },

    // When a question can't change the map
    "question.noPlaces": {
        en: "None of these places are inside the game area. By the rules the question has no answer, but it still counts.",
        de: "Keiner dieser Orte liegt im Spielgebiet. Laut Regeln hat die Frage keine Antwort, sie zählt aber trotzdem.",
    },
    "question.onePlace": {
        en: "Only one of these places is inside the game area, so everyone's nearest one is the same. The map doesn't change.",
        de: "Nur einer dieser Orte liegt im Spielgebiet, also ist für alle derselbe am nächsten. Die Karte ändert sich nicht.",
    },
    "question.noLandmass": {
        en: "There are no separate landmasses in the game area. The map doesn't change.",
        de: "Im Spielgebiet gibt es keine eigenen Landmassen. Die Karte ändert sich nicht.",
    },
    "question.noBoundary": {
        en: "No boundary found for this zone",
        de: "Für dieses Gebiet wurde keine Grenze gefunden",
    },
    "question.noEnglishName": {
        en: "No English name found for this zone",
        de: "Dieses Gebiet hat keinen englischen Namen",
    },
    "question.noStreet": {
        en: "No street or path found near the seekers",
        de: "Bei den Seekern wurde keine Straße und kein Weg gefunden",
    },
    "question.noWater": {
        en: "No named bodies of water inside the game area. By the rules the question has no answer, but it still counts.",
        de: "Keine benannten Gewässer im Spielgebiet. Laut Regeln hat die Frage keine Antwort, sie zählt aber trotzdem.",
    },
    "question.noAdminBorder": {
        en: "No admin boundary found at this location",
        de: "An diesem Ort wurde keine Verwaltungsgrenze gefunden",
    },
    "question.noElevation": {
        en: "Couldn't load elevation data",
        de: "Die Höhendaten ließen sich nicht laden",
    },
    "question.lineCustomList": {
        en: '"Same train line" doesn\'t work with a custom-only station list, so it is skipped.',
        de: "„Öffi-Linie“ geht nicht mit einer reinen eigenen Stationsliste und wird übersprungen.",
    },
    "question.lineNoData": {
        en: 'The nearest station has no line data, so "Same train line" is skipped.',
        de: "Die nächste Station hat keine Liniendaten, „Öffi-Linie“ wird übersprungen.",
    },
    "question.lineNotFound": {
        en: "No train line found for {station}",
        de: "Bei {station} wurde keine Linie gefunden",
    },
    "question.stationNoName": {
        en: "The seekers' station has no name",
        de: "Die Station der Seeker hat keinen Namen",
    },
    "question.noStationTypes": {
        en: "Choose at least one kind of station",
        de: "Wähle mindestens eine Art von Station",
    },
    "question.zonesFailed": {
        en: "Couldn't work out the hiding zones",
        de: "Die Zonen ließen sich nicht berechnen",
    },
    "question.zoneDetailFailed": {
        en: "Couldn't work out where in the zone the hider can be",
        de: "Es ließ sich nicht berechnen, wo in der Zone der Hider sein kann",
    },
    "question.zoneRuledOut": {
        en: "The answers together rule out this whole zone, so the hider can't be in it.",
        de: "Die Antworten zusammen schließen diese ganze Zone aus, der Hider kann also nicht dort sein.",
    },
    "question.mapFailed": {
        en: "Couldn't work out the map",
        de: "Die Karte ließ sich nicht berechnen",
    },
    "question.nothingLeft": {
        en: "The answers rule out everything, so one of them must be wrong. Check the last answer you entered (Questions → Edit).",
        de: "Die Antworten schließen alles aus, eine davon stimmt also nicht. Prüft die zuletzt eingetippte Antwort (Fragen → Ändern).",
    },

    // Adding questions of every type (for experts)
    "add.description": {
        en: "Select which question type you would like to add.",
        de: "Welche Art von Frage möchtest du hinzufügen?",
    },
    "add.radar": { en: "Add Radar", de: "Radar hinzufügen" },
    "add.thermometer": {
        en: "Add Thermometer",
        de: "Thermometer hinzufügen",
    },
    "add.tentacles": { en: "Add Tentacles", de: "Tentakel hinzufügen" },
    "add.matching": { en: "Add Matching", de: "Matching hinzufügen" },
    "add.measuring": { en: "Add Measuring", de: "Measuring hinzufügen" },
    "add.excludeCountry": {
        en: "Exclude Country",
        de: "Staat ausschließen",
    },
    "add.paste": { en: "Paste Question", de: "Frage einfügen" },
    "add.pasted": {
        en: "Question added from clipboard",
        de: "Frage aus der Zwischenablage hinzugefügt",
    },
    "add.pasteFailed": {
        en: "No valid question found in clipboard",
        de: "In der Zwischenablage ist keine gültige Frage",
    },
    "custom.title": { en: "New Custom Question", de: "Neue eigene Frage" },
    "custom.text": {
        en: "Do you want the new question to start blank, or copy what the current question contains?",
        de: "Soll die neue Frage leer beginnen oder den Inhalt der aktuellen Frage übernehmen?",
    },
    "custom.blank": { en: "Start blank", de: "Leer beginnen" },
    "custom.copy": { en: "Copy from current", de: "Aktuelle übernehmen" },

    // The clipboard
    "clipboard.unsupported": {
        en: "This browser can't use the clipboard",
        de: "Dieser Browser kann die Zwischenablage nicht nutzen",
    },
    "clipboard.reading": {
        en: "Reading from clipboard...",
        de: "Lese die Zwischenablage …",
    },
    "clipboard.writing": { en: "Copying...", de: "Kopiere …" },
    "clipboard.copyFailed": {
        en: "Couldn't copy to the clipboard",
        de: "Kopieren in die Zwischenablage hat nicht geklappt",
    },

    // Presets for custom questions
    "presets.title": { en: "Custom Presets", de: "Eigene Vorlagen" },
    "presets.use": { en: "Use presets", de: "Vorlagen verwenden" },
    "presets.save": { en: "Save as preset", de: "Als Vorlage speichern" },
    "presets.fromClipboard": {
        en: "Apply from clipboard",
        de: "Aus Zwischenablage übernehmen",
    },
    "presets.none": {
        en: "No presets saved.",
        de: "Keine Vorlagen gespeichert.",
    },
    "presets.load": { en: "Load", de: "Laden" },
    "presets.rename": { en: "Rename", de: "Umbenennen" },
    "presets.share": { en: "Share", de: "Teilen" },
    "presets.namePrompt": {
        en: "Name for this preset",
        de: "Name für diese Vorlage",
    },
    "presets.renamePrompt": {
        en: "New preset name",
        de: "Neuer Name der Vorlage",
    },
    "presets.saved": {
        en: 'Saved preset "{name}"',
        de: "Vorlage „{name}“ gespeichert",
    },
    "presets.loaded": {
        en: 'Loaded preset "{name}"',
        de: "Vorlage „{name}“ geladen",
    },
    "presets.renamed": {
        en: 'Renamed preset to "{name}"',
        de: "Vorlage in „{name}“ umbenannt",
    },
    "presets.deleteConfirm": {
        en: 'Delete preset "{name}"?',
        de: "Vorlage „{name}“ löschen?",
    },
    "presets.deleted": {
        en: 'Deleted preset "{name}"',
        de: "Vorlage „{name}“ gelöscht",
    },
    "presets.copied": {
        en: "Preset copied to clipboard",
        de: "Vorlage in die Zwischenablage kopiert",
    },
    "presets.clipboardEmpty": {
        en: "The clipboard is empty",
        de: "Die Zwischenablage ist leer",
    },
    "presets.notPreset": {
        en: "The clipboard holds no preset",
        de: "In der Zwischenablage ist keine Vorlage",
    },
    "presets.applied": {
        en: 'Applied preset "{name}"',
        de: "Vorlage „{name}“ übernommen",
    },
    "presets.appliedFromClipboard": {
        en: "Applied preset from clipboard",
        de: "Vorlage aus der Zwischenablage übernommen",
    },
    "presets.readFailed": {
        en: "Couldn't read the clipboard",
        de: "Die Zwischenablage ließ sich nicht lesen",
    },

    // Coordinates (drawing tools)
    "coords.location": { en: "Location", de: "Ort" },
    "coords.latitude": { en: "Latitude", de: "Breite" },
    "coords.longitude": { en: "Longitude", de: "Länge" },
    "coords.edit": { en: "Edit coordinates", de: "Koordinaten ändern" },
    "coords.update": { en: "Update {label}", de: "{label} ändern" },
    "coords.done": { en: "Done", de: "Fertig" },
    "coords.current": {
        en: "Set to current location",
        de: "Auf meinen Standort setzen",
    },
    "coords.paste": {
        en: "Paste coordinates from clipboard",
        de: "Koordinaten aus der Zwischenablage einfügen",
    },
    "coords.copy": {
        en: "Copy coordinates to clipboard",
        de: "Koordinaten kopieren",
    },
    "coords.noGeolocation": {
        en: "This browser can't get your location",
        de: "Dieser Browser kann deinen Standort nicht bestimmen",
    },
    "coords.locating": {
        en: "Getting your location...",
        de: "Suche deinen Standort …",
    },
    "coords.located": { en: "Location found", de: "Standort gefunden" },
    "coords.notFound": {
        en: "No coordinates in the clipboard",
        de: "In der Zwischenablage stehen keine Koordinaten",
    },
    "coords.pasted": {
        en: "Coordinates set from clipboard",
        de: "Koordinaten aus der Zwischenablage übernommen",
    },
    "coords.copied": { en: "Coordinates copied", de: "Koordinaten kopiert" },
    "coords.searchPlace": { en: "Search place...", de: "Ort suchen …" },
    "coords.searching": { en: "Loading...", de: "Lädt …" },
    "coords.searchFailed": {
        en: "Couldn't load places.",
        de: "Orte ließen sich nicht laden.",
    },
    "coords.noPlaces": {
        en: "No locations found.",
        de: "Keine Orte gefunden.",
    },

    // The game area (Settings > Advanced)
    "area.polygon": { en: "Polygon selected", de: "Gezeichnetes Gebiet" },
    "area.none": { en: "Game area", de: "Spielgebiet" },
    "area.included": { en: "Included location", de: "Eingeschlossener Ort" },
    "area.excluded": { en: "Excluded location", de: "Ausgeschlossener Ort" },
    "area.needAnother": {
        en: "Add another location first.",
        de: "Füge zuerst einen weiteren Ort hinzu.",
    },
    "area.searchDown": {
        en: "{photon} is down. Please draw the game area on the map instead.",
        de: "{photon} ist nicht erreichbar. Zeichne das Spielgebiet stattdessen auf der Karte.",
    },
    "area.clear": {
        en: "Clear Questions & Cache",
        de: "Fragen und Cache löschen",
    },
    "area.reuse": {
        en: "Reuse Preset Locations",
        de: "Gewählte Orte wieder verwenden",
    },

    // Drawing on the map (for experts)
    "draw.hidingZone": {
        en: "Draw the game area",
        de: "Spielgebiet zeichnen",
    },
    "draw.matching": {
        en: "Draw the matching zone(s)",
        de: "Matching-Gebiet(e) zeichnen",
    },
    "draw.measuring": {
        en: "Draw the measuring zone(s)",
        de: "Measuring-Gebiet(e) zeichnen",
    },
    "draw.polyline": { en: "Draw a line", de: "Linie zeichnen" },
    "draw.marker": { en: "Draw a marker", de: "Punkt setzen" },
    "draw.cancel": { en: "Cancel", de: "Abbrechen" },
    "draw.cancelTitle": {
        en: "Cancel drawing",
        de: "Zeichnen abbrechen",
    },
    "draw.finish": { en: "Finish", de: "Fertig" },
    "draw.finishTitle": {
        en: "Finish drawing",
        de: "Zeichnen beenden",
    },
    "draw.undo": { en: "Delete last point", de: "Letzten Punkt löschen" },
    "draw.markerStart": {
        en: "Click map to place marker.",
        de: "Tippe auf die Karte, um einen Punkt zu setzen.",
    },
    "draw.polygonStart": {
        en: "Click to start drawing shape.",
        de: "Tippe, um mit dem Zeichnen zu beginnen.",
    },
    "draw.polygonCont": {
        en: "Click to continue drawing shape.",
        de: "Tippe, um weiterzuzeichnen.",
    },
    "draw.polygonEnd": {
        en: "Click first point to close this shape.",
        de: "Tippe auf den ersten Punkt, um die Fläche zu schließen.",
    },
    "draw.lineError": {
        en: "<strong>Error:</strong> shape edges cannot cross!",
        de: "<strong>Fehler:</strong> Die Kanten dürfen sich nicht kreuzen!",
    },
    "draw.lineStart": {
        en: "Click to start drawing line.",
        de: "Tippe, um die Linie zu beginnen.",
    },
    "draw.lineCont": {
        en: "Click to continue drawing line.",
        de: "Tippe, um die Linie fortzusetzen.",
    },
    "draw.lineEnd": {
        en: "Click last point to finish line.",
        de: "Tippe auf den letzten Punkt, um die Linie zu beenden.",
    },
    "draw.save": { en: "Save", de: "Speichern" },
    "draw.saveTitle": { en: "Save changes", de: "Änderungen speichern" },
    "draw.cancelEditTitle": {
        en: "Cancel editing, discards all changes",
        de: "Bearbeiten abbrechen, alle Änderungen verwerfen",
    },
    "draw.clearAll": { en: "Clear all", de: "Alles löschen" },
    "draw.clearAllTitle": {
        en: "Clear all layers",
        de: "Alles Gezeichnete löschen",
    },
    "draw.edit": { en: "Edit layers", de: "Gezeichnetes bearbeiten" },
    "draw.editDisabled": {
        en: "No layers to edit",
        de: "Nichts zum Bearbeiten",
    },
    "draw.remove": { en: "Delete layers", de: "Gezeichnetes löschen" },
    "draw.removeDisabled": {
        en: "No layers to delete",
        de: "Nichts zum Löschen",
    },
    "draw.editText": {
        en: "Drag handles or markers to edit features.",
        de: "Ziehe die Griffe oder Punkte, um zu bearbeiten.",
    },
    "draw.editSubtext": {
        en: "Click cancel to undo changes.",
        de: "Mit „Abbrechen“ machst du die Änderungen rückgängig.",
    },
    "draw.removeText": {
        en: "Click on a feature to remove.",
        de: "Tippe auf etwas, um es zu löschen.",
    },

    // Tentacles (for experts)
    "tentacles.locationType": { en: "Location Type", de: "Art des Orts" },
    "tentacles.location": { en: "Location", de: "Ort" },
    "card.drawTentacles": {
        en: "tentacle locations",
        de: "die Tentakel-Orte",
    },

    // Lists to choose from
    "select.placeholder": { en: "Select options", de: "Auswählen" },
    "select.search": { en: "Search...", de: "Suchen …" },
    "select.none": { en: "No results found.", de: "Nichts gefunden." },
    "select.all": { en: "(Select All)", de: "(Alle auswählen)" },
    "select.more": { en: "+ {count} more", de: "+ {count} weitere" },
    "select.clear": { en: "Clear", de: "Leeren" },
    "select.close": { en: "Close", de: "Schließen" },
    "common.close": { en: "Close", de: "Schließen" },
    "sidebar.toggle": {
        en: "Toggle Sidebar",
        de: "Seitenleiste ein- oder ausblenden",
    },

    // The kinds of questions, for experts ("Show all question types?")
    "type.group.hidingZone": { en: "Hiding Zone Mode", de: "Zonen-Modus" },
    "type.group.tentacles24": {
        en: "24 km (Typically)",
        de: "Meist 24 km",
    },
    "type.group.tentacles1.6": {
        en: "1.6 km (Typically)",
        de: "Meist 1,6 km",
    },
    "type.airport": {
        en: "Commercial Airport In Zone Question",
        de: "Verkehrsflughafen in der Zone",
    },
    "type.major-city": {
        en: "Major City (1,000,000+ people) In Zone Question",
        de: "Großstadt (über 1 Mio. Menschen) in der Zone",
    },
    "type.major-city.measuring": {
        en: "Major City (1,000,000+ people) Question",
        de: "Großstadt (über 1 Mio. Menschen)",
    },
    "type.aquarium-full": {
        en: "Aquarium Question (Small+Medium Games)",
        de: "Aquarium (Small und Medium)",
    },
    "type.zoo-full": {
        en: "Zoo Question (Small+Medium Games)",
        de: "Zoo (Small und Medium)",
    },
    "type.theme_park-full": {
        en: "Theme Park Question (Small+Medium Games)",
        de: "Vergnügungspark (Small und Medium)",
    },
    "type.peak-full": {
        en: "Mountain Question (Small+Medium Games)",
        de: "Berg (Small und Medium)",
    },
    "type.museum-full": {
        en: "Museum Question (Small+Medium Games)",
        de: "Museum (Small und Medium)",
    },
    "type.hospital-full": {
        en: "Hospital Question (Small+Medium Games)",
        de: "Krankenhaus (Small und Medium)",
    },
    "type.cinema-full": {
        en: "Cinema Question (Small+Medium Games)",
        de: "Kino (Small und Medium)",
    },
    "type.library-full": {
        en: "Library Question (Small+Medium Games)",
        de: "Bibliothek (Small und Medium)",
    },
    "type.golf_course-full": {
        en: "Golf Course Question (Small+Medium Games)",
        de: "Golfplatz (Small und Medium)",
    },
    "type.consulate-full": {
        en: "Foreign Consulate Question (Small+Medium Games)",
        de: "Konsulat (Small und Medium)",
    },
    "type.park-full": {
        en: "Park Question (Small+Medium Games)",
        de: "Park (Small und Medium)",
    },
    "type.aquarium": { en: "Aquarium Question", de: "Aquarium" },
    "type.zoo": { en: "Zoo Question", de: "Zoo" },
    "type.theme_park": { en: "Theme Park Question", de: "Vergnügungspark" },
    "type.peak": { en: "Mountain Question", de: "Berg" },
    "type.museum": { en: "Museum Question", de: "Museum" },
    "type.hospital": { en: "Hospital Question", de: "Krankenhaus" },
    "type.cinema": { en: "Cinema Question", de: "Kino" },
    "type.library": { en: "Library Question", de: "Bibliothek" },
    "type.golf_course": { en: "Golf Course Question", de: "Golfplatz" },
    "type.consulate": { en: "Foreign Consulate Question", de: "Konsulat" },
    "type.park": { en: "Park Question", de: "Park" },
    "type.street": { en: "Street or Path Question", de: "Straße oder Weg" },
    "type.landmass": { en: "Landmass Question", de: "Landmasse" },
    "type.zone": { en: "Zone Question", de: "Verwaltungsgebiet" },
    "type.letter-zone": {
        en: "Zone Starts With Same Letter Question",
        de: "Verwaltungsgebiet mit gleichem Anfangsbuchstaben",
    },
    "type.same-first-letter-station": {
        en: "Station Starts With Same Letter Question",
        de: "Station mit gleichem Anfangsbuchstaben",
    },
    "type.same-length-station": {
        en: "Station Has Same Length Question",
        de: "Stationsname gleich lang",
    },
    "type.same-train-line": {
        en: "Station On Same Train Line Question",
        de: "Station an derselben Linie",
    },
    "type.custom-zone": { en: "Custom Zone Question", de: "Eigenes Gebiet" },
    "type.custom-points": {
        en: "Custom Points Question",
        de: "Eigene Punkte",
    },
    "type.coastline": { en: "Coastline Question", de: "Küste" },
    "type.highspeed-measure-shinkansen": {
        en: "High-Speed Rail Question",
        de: "Schnellfahrstrecke",
    },
    "type.admin-measure": {
        en: "Admin Border Question",
        de: "Verwaltungsgrenze",
    },
    "type.water": { en: "Body of Water Question", de: "Gewässer" },
    "type.sea-level": { en: "Sea Level Question", de: "Seehöhe" },
    "type.mcdonalds": { en: "McDonald's Question", de: "McDonald's" },
    "type.seven11": { en: "7-Eleven Question", de: "7-Eleven" },
    "type.rail-measure": { en: "Train Station Question", de: "Bahnhof" },
    "type.custom-measure": {
        en: "Custom Measuring Question",
        de: "Eigene Measuring-Frage",
    },
    "type.tentacles.theme_park": { en: "Theme Parks", de: "Vergnügungsparks" },
    "type.tentacles.zoo": { en: "Zoos", de: "Zoos" },
    "type.tentacles.aquarium": { en: "Aquariums", de: "Aquarien" },
    "type.tentacles.museum": { en: "Museums", de: "Museen" },
    "type.tentacles.hospital": { en: "Hospitals", de: "Krankenhäuser" },
    "type.tentacles.cinema": { en: "Movie Theaters", de: "Kinos" },
    "type.tentacles.library": { en: "Libraries", de: "Bibliotheken" },
    "type.tentacles.custom": { en: "Custom Locations", de: "Eigene Orte" },
} satisfies Record<string, Text>;

export type MessageKey = keyof typeof messages;
