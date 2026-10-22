import { useStore } from "@nanostores/react";
import { LocateFixedIcon, MapPinIcon, XIcon } from "lucide-react";
import { toast } from "react-toastify";

import {
    allTrainStations,
    disabledStations,
    displayHidingZones,
    leafletMapContext,
    myPosition,
    selectedZoneId,
    trainStations,
    zoneSheetOpen,
} from "@/lib/context";
import { getCurrentPosition } from "@/lib/gps";
import { extractStationLabel } from "@/maps/geo-utils";

import { Button } from "./ui/button";
import { stationId, toggleZone, zonesLeft } from "./ZoneSheet";

/**
 * Top of the map: how many hiding zones are left, or the name of the zone
 * picked on the map or in the zone list.
 */
export const ZoneCounter = () => {
    const $displayHidingZones = useStore(displayHidingZones);
    const $stations = useStore(trainStations);
    const $disabledStations = useStore(disabledStations);
    const $allTrainStations = useStore(allTrainStations);
    const $selectedZoneId = useStore(selectedZoneId);

    if (!$displayHidingZones || $allTrainStations.length === 0) return null;

    const selected = $selectedZoneId
        ? $stations.find((station) => stationId(station) === $selectedZoneId)
        : undefined;

    if (selected) {
        const ruledOut = $disabledStations.includes($selectedZoneId);
        return (
            <div className="flex max-w-[calc(100vw-5rem)] items-center gap-1 rounded-full border bg-background/95 py-1 pl-3 pr-1 text-sm text-foreground shadow-lg">
                <MapPinIcon className="h-4 w-4 shrink-0 text-green-500" />
                <span className="min-w-0 truncate font-semibold">
                    {extractStationLabel(selected.properties)}
                </span>
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

/** Moves the map to your own position (the blue dot). */
export const LocateButton = () => {
    const locate = async () => {
        const map = leafletMapContext.get();
        if (!map) return;
        const position = myPosition.get() ?? (await getCurrentPosition());
        if (!position) {
            toast.error("Couldn't get your location.", { autoClose: 3000 });
            return;
        }
        map.setView([position.lat, position.lng], Math.max(map.getZoom(), 15));
    };

    return (
        <Button
            size="icon"
            variant="outline"
            className="h-11 w-11 rounded-full bg-background/95 text-foreground shadow-lg"
            title="Show my location"
            onClick={locate}
        >
            <LocateFixedIcon className="!size-5" />
        </Button>
    );
};
