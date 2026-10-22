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
import { preloadGameData } from "@/maps/preload";

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

    // While the hider hides, load what the question cards will need
    preloadGameData({ refreshOldData: true });
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
                    title="Vienna, Small game: U-Bahn stations only, 500 m"
                >
                    New Game
                </Button>
            </AlertDialogTrigger>
            {/* Only rendered when open: the dialog needs the browser's document */}
            {open && (
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Start a new game (Vienna, Small)?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            The game area is Vienna. Hiding zones are all U-Bahn
                            stations with a 500 m radius. While the hider hides,
                            the app loads the map data for every question card.
                            {$questions.length > 0 &&
                                ` ${
                                    $questions.length === 1
                                        ? "The question disappears"
                                        : `All ${$questions.length} questions disappear`
                                }; you can undo this right afterwards.`}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={startNewGame}
                            className="mb-2 sm:mb-0"
                        >
                            New Game
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            )}
        </AlertDialog>
    );
};
