import { useStore } from "@nanostores/react";
import { useState } from "react";

import {
    additionalMapGeoLocations,
    allTrainStations,
    defaultUnit,
    disabledStations,
    displayHidingZones,
    displayHidingZonesOptions,
    hiderInbox,
    hidingRadius,
    hidingRadiusUnits,
    isLoading,
    mapGeoJSON,
    mapGeoLocation,
    polyGeoJSON,
    questionFinishedMapData,
    questions,
    selectedZoneId,
    SMALL_HIDING_RADIUS_METERS,
    SUBWAY_STATIONS,
    trainStations,
    useCustomStations,
    VIENNA,
} from "@/lib/context";
import { type Role, setRole } from "@/lib/role";
import { cn } from "@/lib/utils";
import { preloadGameData } from "@/maps/preload";

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "./ui/alert-dialog";
import { Button } from "./ui/button";
import { deleteAllQuestionsWithUndo } from "./UndoToast";

/** Vienna, Small game: U-Bahn stations with 500 m hiding zones, no questions. */
export const startNewGame = (role: Role) => {
    mapGeoLocation.set(structuredClone(VIENNA));
    additionalMapGeoLocations.set([]);
    polyGeoJSON.set(null);
    mapGeoJSON.set(null);

    defaultUnit.set("kilometers");
    useCustomStations.set(false);
    disabledStations.set([]);
    selectedZoneId.set("");
    displayHidingZonesOptions.set([SUBWAY_STATIONS]);
    hidingRadius.set(SMALL_HIDING_RADIUS_METERS);
    hidingRadiusUnits.set("meters");

    // Hiding zones are rebuilt once the map of the new game area is ready
    questionFinishedMapData.set(null);
    trainStations.set([]);
    allTrainStations.set([]);
    displayHidingZones.set(true);

    hiderInbox.set([]);
    setRole(role);

    // Clearing the questions also reloads the map
    if (questions.get().length > 0) {
        deleteAllQuestionsWithUndo();
    } else {
        questions.set([]);
    }

    // While the hider hides, load what the question cards will need
    preloadGameData({ refreshOldData: true });
};

export const NewGameDialog = ({
    className,
    onStart,
}: {
    className?: string;
    /** Called once the new game has started, e.g. to close the settings. */
    onStart?: () => void;
}) => {
    const $isLoading = useStore(isLoading);
    const $questions = useStore(questions);
    const [open, setOpen] = useState(false);

    return (
        <AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogTrigger asChild>
                <Button
                    className={cn(
                        "bg-blue-600 font-semibold text-white shadow-md hover:bg-blue-700",
                        className,
                    )}
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
                    <div className="flex flex-col gap-2">
                        <span className="text-sm font-semibold">
                            Your role on this phone:
                        </span>
                        {(
                            [
                                ["seeker", "I'm seeking"],
                                ["hider", "I'm hiding"],
                            ] as const
                        ).map(([role, label]) => (
                            <AlertDialogAction
                                key={role}
                                onClick={() => {
                                    startNewGame(role);
                                    onStart?.();
                                }}
                                className={cn(
                                    "h-14 text-lg font-semibold text-white",
                                    role === "seeker"
                                        ? "bg-blue-600 hover:bg-blue-700"
                                        : "bg-violet-700 hover:bg-violet-800",
                                )}
                            >
                                {label}
                            </AlertDialogAction>
                        ))}
                        <AlertDialogCancel className="mt-0 h-12">
                            Cancel
                        </AlertDialogCancel>
                    </div>
                </AlertDialogContent>
            )}
        </AlertDialog>
    );
};
