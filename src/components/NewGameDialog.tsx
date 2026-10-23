import { useStore } from "@nanostores/react";
import { useState } from "react";

import {
    additionalMapGeoLocations,
    allTrainStations,
    disabledStations,
    displayHidingZones,
    displayHidingZonesOptions,
    hiderInbox,
    hiderZoneId,
    hidingRadius,
    hidingRadiusUnits,
    isLoading,
    keptZonesRuledOut,
    mapGeoJSON,
    mapGeoLocation,
    photoQuestions,
    polyGeoJSON,
    questionFinishedMapData,
    questions,
    selectedZoneId,
    SMALL_HIDING_RADIUS_METERS,
    SUBWAY_STATIONS,
    thermometerRun,
    trainStations,
    useCustomStations,
    VIENNA,
} from "@/lib/context";
import { t, useLanguage } from "@/lib/i18n";
import { type Role, setRole } from "@/lib/role";
import { cn } from "@/lib/utils";
import { endRound, pauseForLateAnswers } from "@/maps/gameClock";
import { lateIntervals } from "@/maps/hiderLog";
import { preloadGameData } from "@/maps/preload";
import { choosingHiderZone } from "@/maps/zones";

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

    useCustomStations.set(false);
    disabledStations.set([]);
    keptZonesRuledOut.set([]);
    selectedZoneId.set("");
    hiderZoneId.set("");
    choosingHiderZone.set(false);
    displayHidingZonesOptions.set([SUBWAY_STATIONS]);
    hidingRadius.set(SMALL_HIDING_RADIUS_METERS);
    hidingRadiusUnits.set("meters");

    // Hiding zones are rebuilt once the map of the new game area is ready
    questionFinishedMapData.set(null);
    trainStations.set([]);
    allTrainStations.set([]);
    displayHidingZones.set(true);

    // The round's hiding time stays in the list of past rounds; the hider
    // starts the clock again when the hiding period begins
    endRound(
        Date.now(),
        pauseForLateAnswers.get() ? lateIntervals(hiderInbox.get()) : [],
    );
    hiderInbox.set([]);
    thermometerRun.set(null);
    setRole(role);

    // Clearing the questions also reloads the map
    if (questions.get().length > 0 || photoQuestions.get().length > 0) {
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
    useLanguage();
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
                    title={t("newGame.hint")}
                >
                    {t("newGame.button")}
                </Button>
            </AlertDialogTrigger>
            {/* Only rendered when open: the dialog needs the browser's document */}
            {open && (
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {t("newGame.title")}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {t("newGame.text")}
                            {$questions.length > 0 &&
                                ` ${
                                    $questions.length === 1
                                        ? t("newGame.deletesOne")
                                        : t("newGame.deletesMany", {
                                              count: $questions.length,
                                          })
                                }`}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="flex flex-col gap-2">
                        <span className="text-sm font-semibold">
                            {t("role.label")}:
                        </span>
                        {(
                            [
                                ["seeker", t("role.seeking")],
                                ["hider", t("role.hiding")],
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
                            {t("common.cancel")}
                        </AlertDialogCancel>
                    </div>
                </AlertDialogContent>
            )}
        </AlertDialog>
    );
};
