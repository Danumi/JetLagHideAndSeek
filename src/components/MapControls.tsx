import { useStore } from "@nanostores/react";
import {
    LocateFixedIcon,
    LocateIcon,
    MapPinIcon,
    TriangleAlertIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";

import {
    allTrainStations,
    disabledStations,
    displayHidingZones,
    followMyPosition,
    hiderMode,
    hiderZoneId,
    keptZonesRuledOut,
    myPosition,
    selectedZoneId,
    trainStations,
    zoneSheetOpen,
} from "@/lib/context";
import { followMe } from "@/lib/gps";
import { cn } from "@/lib/utils";
import { formatKilometers } from "@/maps/answers";
import { findStationLines } from "@/maps/api";
import { extractStationLabel } from "@/maps/geo-utils";
import {
    hiderZoneCheck,
    type ZoneCheck,
    zoneCheckText,
} from "@/maps/hidingZoneCheck";
import {
    canShowAllZones,
    showAllZones,
    toggleZone,
    zonesLeft,
} from "@/maps/zones";

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogHeader,
    AlertDialogTitle,
} from "./ui/alert-dialog";
import { Button } from "./ui/button";
import { keepOnlyZonesWithUndo } from "./UndoToast";

/** U-Bahn and S-Bahn lines that stop at a station, like "U1 U2 U4". */
const useStationLines = (id: string) => {
    const [lines, setLines] = useState<{ id: string; text: string } | null>(
        null,
    );

    useEffect(() => {
        // Only OSM stations have lines; custom stations don't
        if (!id.includes("/")) return;
        let cancelled = false;
        findStationLines(id)
            .then((all) => {
                const text = all
                    .filter(
                        (line) =>
                            line.route === "subway" ||
                            (line.route === "train" &&
                                /^S\d+$/.test(line.label)),
                    )
                    .map((line) => line.label)
                    .join(" ");
                if (!cancelled) setLines({ id, text });
            })
            .catch((error) => console.log(error));
        return () => {
            cancelled = true;
        };
    }, [id]);

    return lines?.id === id ? lines.text : "";
};

/**
 * GPS jumps a few meters, more underground: only this far outside (or as
 * far as the GPS may be off) counts as leaving the zone.
 */
const LEAVING_MARGIN_METERS = 20;

/** Warns the hider once they walk out of the hiding zone they were in. */
const useLeavingZoneWarning = (check: ZoneCheck | null) => {
    const wasInside = useRef(false);
    const zone = useRef("");

    useEffect(() => {
        if (!check) return;
        // Another zone (e.g. just chosen): only leaving it counts
        const key = `${check.chosen}:${check.id}`;
        if (zone.current !== key) {
            zone.current = key;
            wasInside.current = false;
        }
        if (check.inside) {
            wasInside.current = true;
            return;
        }
        if (
            check.toEdge < Math.max(LEAVING_MARGIN_METERS, check.accuracy ?? 0)
        ) {
            return;
        }
        if (wasInside.current) {
            toast.warning(
                `You left your hiding zone: the ${check.station} zone is ${formatKilometers(check.toEdge / 1000)} away.`,
                { autoClose: 10000, toastId: "left-hiding-zone" },
            );
            navigator.vibrate?.([300, 150, 300]);
        }
        wasInside.current = false;
    }, [check]);
};

/** The hider's zone check, in place of the zone counter. */
const HiderZoneCheck = ({ check }: { check: ZoneCheck }) => {
    const { title, detail } = zoneCheckText(check);
    return (
        <div
            className={cn(
                "flex max-w-[calc(100vw-5rem)] items-center gap-1.5 rounded-full border-2 bg-background/95 px-3 py-1 text-sm text-foreground shadow-lg",
                !check.chosen
                    ? "border-violet-600"
                    : check.inside
                      ? "border-green-600"
                      : "border-orange-500",
            )}
        >
            {!check.chosen ? (
                <MapPinIcon className="h-4 w-4 shrink-0 text-violet-500" />
            ) : check.inside ? (
                <MapPinIcon className="h-4 w-4 shrink-0 text-green-500" />
            ) : (
                <TriangleAlertIcon className="h-4 w-4 shrink-0 text-orange-500" />
            )}
            <span className="min-w-0 truncate">
                <span className="font-semibold">{title}</span>
                <span className="text-muted-foreground"> · {detail}</span>
            </span>
        </div>
    );
};

/** "Choose as my zone" on the hider's phone, asking first before a change. */
const ChooseZoneButton = ({ id, name }: { id: string; name: string }) => {
    const $hiderZoneId = useStore(hiderZoneId);
    const $allTrainStations = useStore(allTrainStations);
    const [confirm, setConfirm] = useState(false);

    if ($hiderZoneId === id) {
        return (
            <span className="px-1 text-xs font-semibold text-violet-500">
                Your hiding zone
            </span>
        );
    }

    const current = $allTrainStations.find(
        (station) => station.properties.id === $hiderZoneId,
    );
    const choose = () => {
        hiderZoneId.set(id);
        selectedZoneId.set("");
    };

    return (
        <>
            <Button
                size="sm"
                className="h-8 rounded-full bg-violet-700 px-3 text-xs text-white hover:bg-violet-800"
                onClick={() => (current ? setConfirm(true) : choose())}
            >
                Choose as my zone
            </Button>
            <AlertDialog open={confirm} onOpenChange={setConfirm}>
                {/* Only rendered when open: the dialog needs the browser's document */}
                {confirm && current && (
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>
                                Change your hiding zone?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                                Your zone is {extractStationLabel(current)}. For
                                the endgame, only {name} will count.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <div className="flex flex-col gap-2">
                            <AlertDialogAction
                                className="h-12 bg-violet-700 font-semibold text-white hover:bg-violet-800"
                                onClick={choose}
                            >
                                Change to {name}
                            </AlertDialogAction>
                            <AlertDialogCancel className="mt-0 h-12">
                                Keep {extractStationLabel(current)}
                            </AlertDialogCancel>
                        </div>
                    </AlertDialogContent>
                )}
            </AlertDialog>
        </>
    );
};

/**
 * The zone tapped on the map or in the zone list: its station and lines,
 * and what you can do with it. A tap elsewhere on the map closes it.
 */
const SelectedZone = ({ id, hider }: { id: string; hider: boolean }) => {
    const $stations = useStore(trainStations);
    const $disabledStations = useStore(disabledStations);
    const $allTrainStations = useStore(allTrainStations);
    const lines = useStationLines(id);

    const station = $allTrainStations.find((x) => x.properties.id === id);
    if (!station) return null;

    const name = String(extractStationLabel(station));
    const ruledOut = $disabledStations.includes(id);
    const left = zonesLeft($stations, $disabledStations);
    const onlyOneLeft = left.length === 1 && !ruledOut;

    return (
        <div className="flex max-w-[calc(100vw-5rem)] flex-col gap-1.5 rounded-2xl border bg-background/95 p-2 pl-3 text-sm text-foreground shadow-lg">
            <div className="flex min-w-0 items-center gap-1.5">
                <MapPinIcon className="h-4 w-4 shrink-0 text-green-500" />
                <span className="min-w-0 truncate">
                    <span className="font-semibold">{name}</span>
                    {lines && (
                        <span className="text-muted-foreground">
                            {" "}
                            · {lines}
                        </span>
                    )}
                </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
                {hider ? (
                    <ChooseZoneButton id={id} name={name} />
                ) : (
                    <>
                        <Button
                            size="sm"
                            variant="outline"
                            className="h-8 rounded-full px-3 text-xs"
                            onClick={() => {
                                toggleZone(id);
                                selectedZoneId.set("");
                            }}
                        >
                            {ruledOut ? "Back in" : "Rule out"}
                        </Button>
                        {!ruledOut && !onlyOneLeft && (
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-8 rounded-full px-3 text-xs"
                                onClick={() => {
                                    keepOnlyZonesWithUndo([id], name);
                                    selectedZoneId.set("");
                                }}
                            >
                                Only this zone
                            </Button>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

/**
 * Top of the map: how many hiding zones are left (the hider: whether they
 * are in their hiding zone), or the zone tapped on the map or in the list.
 */
export const ZoneCounter = () => {
    const $hiderMode = useStore(hiderMode);
    const $zoneCheck = useStore(hiderZoneCheck);
    const $displayHidingZones = useStore(displayHidingZones);
    const $stations = useStore(trainStations);
    const $disabledStations = useStore(disabledStations);
    const $keptZonesRuledOut = useStore(keptZonesRuledOut);
    const $allTrainStations = useStore(allTrainStations);
    const $selectedZoneId = useStore(selectedZoneId);
    useLeavingZoneWarning($zoneCheck);
    const hider = $hiderMode !== false;

    if (!$displayHidingZones || $allTrainStations.length === 0) return null;

    if (
        $selectedZoneId &&
        $allTrainStations.some((x) => x.properties.id === $selectedZoneId)
    ) {
        return <SelectedZone id={$selectedZoneId} hider={hider} />;
    }

    if (hider) {
        return $zoneCheck ? <HiderZoneCheck check={$zoneCheck} /> : null;
    }

    const left = zonesLeft($stations, $disabledStations).length;

    return (
        <div className="flex max-w-[calc(100vw-5rem)] items-center rounded-full border bg-background/95 text-sm text-foreground shadow-lg">
            <button
                className="whitespace-nowrap px-3 py-1.5"
                onClick={() => zoneSheetOpen.set(true)}
            >
                <span className="font-semibold">{left}</span> of{" "}
                {$allTrainStations.length} zones left
            </button>
            {canShowAllZones($disabledStations, $keptZonesRuledOut) && (
                <Button
                    size="sm"
                    variant="outline"
                    className="mr-1 h-7 rounded-full px-2 text-xs"
                    onClick={showAllZones}
                >
                    Show all zones
                </Button>
            )}
        </div>
    );
};

/**
 * Moves the map to your own position (the blue dot) and keeps it there.
 * Filled while the map follows you.
 */
export const LocateButton = () => {
    const $following = useStore(followMyPosition);
    const $myPosition = useStore(myPosition);
    const following = $following && $myPosition !== null;

    return (
        <Button
            size="icon"
            variant="outline"
            className={cn(
                "h-11 w-11 rounded-full bg-background/95 text-foreground shadow-lg",
                following && "text-blue-500",
            )}
            title={following ? "The map follows you" : "Show my location"}
            aria-pressed={following}
            onClick={async () => {
                if (!(await followMe())) {
                    toast.error("Couldn't get your location.", {
                        autoClose: 3000,
                    });
                }
            }}
        >
            {following ? (
                <LocateFixedIcon className="!size-5" />
            ) : (
                <LocateIcon className="!size-5" />
            )}
        </Button>
    );
};
