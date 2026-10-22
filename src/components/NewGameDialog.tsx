import { useStore } from "@nanostores/react";
import { useState } from "react";

import {
    additionalMapGeoLocations,
    allTrainStations,
    defaultUnit,
    disabledStations,
    displayHidingZones,
    displayHidingZonesOptions,
    hidingRadius,
    hidingRadiusUnits,
    isLoading,
    mapGeoJSON,
    mapGeoLocation,
    polyGeoJSON,
    questionFinishedMapData,
    questions,
    SMALL_HIDING_RADIUS_METERS,
    SUBWAY_STATIONS,
    trainStations,
    useCustomStations,
    VIENNA,
} from "@/lib/context";

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "./ui/alert-dialog";
import { Button } from "./ui/button";
import { deleteAllQuestionsWithUndo } from "./UndoToast";

/** Vienna, Small game: U-Bahn stations with 500 m hiding zones, no questions. */
export const startNewGame = () => {
    mapGeoLocation.set(structuredClone(VIENNA));
    additionalMapGeoLocations.set([]);
    polyGeoJSON.set(null);
    mapGeoJSON.set(null);

    defaultUnit.set("kilometers");
    useCustomStations.set(false);
    disabledStations.set([]);
    displayHidingZonesOptions.set([SUBWAY_STATIONS]);
    hidingRadius.set(SMALL_HIDING_RADIUS_METERS);
    hidingRadiusUnits.set("meters");

    // Hiding zones are rebuilt once the map of the new game area is ready
    questionFinishedMapData.set(null);
    trainStations.set([]);
    allTrainStations.set([]);
    displayHidingZones.set(true);

    // Clearing the questions also reloads the map
    if (questions.get().length > 0) {
        deleteAllQuestionsWithUndo();
    } else {
        questions.set([]);
    }
};

export const NewGameDialog = () => {
    const $isLoading = useStore(isLoading);
    const $questions = useStore(questions);
    const [open, setOpen] = useState(false);

    return (
        <AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogTrigger asChild>
                <Button
                    className="shadow-md"
                    disabled={$isLoading}
                    title="Wien, Small: nur U-Bahn-Stationen, 500 m"
                >
                    Neues Spiel
                </Button>
            </AlertDialogTrigger>
            {/* Only rendered when open: the dialog needs the browser's document */}
            {open && (
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Neues Spiel (Wien, Small) starten?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Spielgebiet ist Wien. Hiding Zones sind alle
                            U-Bahn-Stationen mit 500 m Radius.
                            {$questions.length > 0 &&
                                ` ${
                                    $questions.length === 1
                                        ? "Die Frage verschwindet"
                                        : `Alle ${$questions.length} Fragen verschwinden`
                                }; direkt danach kannst du das noch rückgängig machen.`}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={startNewGame}
                            className="mb-2 sm:mb-0"
                        >
                            Neues Spiel
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            )}
        </AlertDialog>
    );
};
