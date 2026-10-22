import { useStore } from "@nanostores/react";
import {
    LocateFixedIcon,
    LocateIcon,
    MapPinIcon,
    TriangleAlertIcon,
    XIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";

import {
    allTrainStations,
    disabledStations,
    displayHidingZones,
    followMyPosition,
    hiderMode,
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

import { Button } from "./ui/button";
import { stationId, toggleZone, zonesLeft } from "./ZoneSheet";

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

    useEffect(() => {
        if (!check) return;
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
                check.inside ? "border-green-600" : "border-orange-500",
            )}
        >
            {check.inside ? (
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

/**
 * Top of the map: how many hiding zones are left (the hider: whether they
 * are in a hiding zone), or the name and lines of the zone picked on the
 * map or in the zone list.
 */
export const ZoneCounter = () => {
    const $hiderMode = useStore(hiderMode);
    const $zoneCheck = useStore(hiderZoneCheck);
    const $displayHidingZones = useStore(displayHidingZones);
    const $stations = useStore(trainStations);
    const $disabledStations = useStore(disabledStations);
    const $allTrainStations = useStore(allTrainStations);
    const $selectedZoneId = useStore(selectedZoneId);
    const lines = useStationLines($selectedZoneId);
    useLeavingZoneWarning($zoneCheck);
    const hider = $hiderMode !== false;

    if (!$displayHidingZones || $allTrainStations.length === 0) return null;

    const selected = $selectedZoneId
        ? $stations.find((station) => stationId(station) === $selectedZoneId)
        : undefined;

    if (selected) {
        const ruledOut = $disabledStations.includes($selectedZoneId);
        return (
            <div className="flex max-w-[calc(100vw-5rem)] items-center gap-1 rounded-full border bg-background/95 py-1 pl-3 pr-1 text-sm text-foreground shadow-lg">
                <MapPinIcon className="h-4 w-4 shrink-0 text-green-500" />
                <span className="min-w-0 truncate">
                    <span className="font-semibold">
                        {extractStationLabel(selected.properties)}
                    </span>
                    {lines && (
                        <span className="text-muted-foreground">
                            {" "}
                            · {lines}
                        </span>
                    )}
                </span>
                {!hider && (
                    <Button
                        size="sm"
                        variant="outline"
                        className="ml-1 h-7 rounded-full px-2 text-xs"
                        onClick={() => {
                            toggleZone($selectedZoneId);
                            selectedZoneId.set("");
                        }}
                    >
                        {ruledOut ? "Back in" : "Rule out"}
                    </Button>
                )}
                <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 shrink-0 rounded-full"
                    title="Show all zones"
                    onClick={() => selectedZoneId.set("")}
                >
                    <XIcon />
                </Button>
            </div>
        );
    }

    if (hider) {
        return $zoneCheck ? <HiderZoneCheck check={$zoneCheck} /> : null;
    }

    const left = zonesLeft($stations, $disabledStations).length;

    return (
        <button
            className="rounded-full border bg-background/95 px-3 py-1.5 text-sm text-foreground shadow-lg"
            onClick={() => zoneSheetOpen.set(true)}
        >
            <span className="font-semibold">{left}</span> of{" "}
            {$allTrainStations.length} zones left
        </button>
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
