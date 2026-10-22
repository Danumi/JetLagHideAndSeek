import { useStore } from "@nanostores/react";
import _ from "lodash";
import {
    ChevronLeftIcon,
    RotateCcwIcon,
    SettingsIcon,
    XIcon,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "react-toastify";

import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerHeader,
    DrawerTitle,
} from "@/components/ui/drawer";
import {
    allTrainStations,
    customStations as customStationsAtom,
    disabledStations,
    displayHidingZones,
    displayHidingZonesOptions,
    displayHidingZonesStyle,
    hidingRadius,
    hidingRadiusUnits,
    includeDefaultStations as includeDefaultStationsAtom,
    isLoading,
    mergeDuplicates as mergeDuplicatesAtom,
    selectedZoneId,
    trainStations,
    useCustomStations as useCustomStationsAtom,
    zoneSheetOpen,
} from "@/lib/context";
import { cn } from "@/lib/utils";
import { parseCustomStationsFromText, type StationCircle } from "@/maps/api";
import { extractStationLabel } from "@/maps/geo-utils";

import { PositiveNumberInput } from "./PositiveNumberInput";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { MultiSelect } from "./ui/multi-select";
import { UnitSelect } from "./UnitSelect";

/** A sideways swipe this far rules a zone out (or back in). */
const SWIPE_PX = 80;

const STYLES = {
    zones: "Zones",
    stations: "Stations",
    "no-overlap": "Merged",
    "no-display": "Hidden",
} as const;

export const stationId = (station: StationCircle) =>
    station.properties.properties.id as string;

/** Hiding zones not ruled out by the questions or by hand. */
export const zonesLeft = (stations: StationCircle[], disabled: string[]) =>
    stations.filter((station) => !disabled.includes(stationId(station)));

export const toggleZone = (id: string) => {
    const disabled = disabledStations.get();
    disabledStations.set(
        disabled.includes(id)
            ? disabled.filter((x) => x !== id)
            : [...disabled, id],
    );
};

/** The list of hiding zones, from the "Zones" button at the bottom. */
export const ZoneSheet = () => {
    const $open = useStore(zoneSheetOpen);
    const $stations = useStore(trainStations);
    const $disabledStations = useStore(disabledStations);
    const $allTrainStations = useStore(allTrainStations);
    const $displayHidingZones = useStore(displayHidingZones);
    const [settings, setSettings] = useState(false);

    const left = zonesLeft($stations, $disabledStations).length;

    return (
        <Drawer
            open={$open}
            onOpenChange={(value) => {
                zoneSheetOpen.set(value);
                if (value) setSettings(false);
            }}
        >
            <DrawerContent className="max-h-[85svh]">
                <div className="mx-auto flex min-h-0 w-full max-w-lg flex-col overflow-hidden">
                    <DrawerHeader className="text-left">
                        <div className="flex items-center gap-2">
                            {settings && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setSettings(false)}
                                    title="Back"
                                >
                                    <ChevronLeftIcon />
                                </Button>
                            )}
                            <DrawerTitle className="flex-1 text-2xl font-semibold font-poppins">
                                {settings ? "Zone settings" : "Hiding zones"}
                            </DrawerTitle>
                            {!settings && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setSettings(true)}
                                >
                                    <SettingsIcon />
                                    Settings
                                </Button>
                            )}
                        </div>
                        <DrawerDescription>
                            {settings
                                ? "Which stations count as hiding zones, and how big they are."
                                : $displayHidingZones
                                  ? `${left} of ${$allTrainStations.length} zones left`
                                  : "Hiding zones are turned off."}
                        </DrawerDescription>
                    </DrawerHeader>
                    <div
                        className="min-h-0 overflow-y-auto px-4 pb-6"
                        data-vaul-no-drag={settings ? true : undefined}
                    >
                        {settings ? <ZoneSettings /> : <ZoneList />}
                    </div>
                </div>
            </DrawerContent>
        </Drawer>
    );
};

const ZoneList = () => {
    const $stations = useStore(trainStations);
    const $disabledStations = useStore(disabledStations);
    const $displayHidingZones = useStore(displayHidingZones);
    const $displayHidingZonesStyle = useStore(displayHidingZonesStyle);
    const $isLoading = useStore(isLoading);
    const [search, setSearch] = useState("");

    if (!$displayHidingZones) {
        return (
            <Button
                className="w-full"
                onClick={() => displayHidingZones.set(true)}
            >
                Show hiding zones
            </Button>
        );
    }

    const term = search.trim().toLowerCase();
    const shown = term
        ? $stations.filter((station) =>
              String(extractStationLabel(station.properties))
                  .toLowerCase()
                  .includes(term),
          )
        : $stations;

    const show = (id: string) => {
        selectedZoneId.set(id);
        zoneSheetOpen.set(false);
    };

    return (
        <div className="flex flex-col gap-3">
            <div className="grid grid-cols-4 gap-1">
                {(Object.keys(STYLES) as (keyof typeof STYLES)[]).map(
                    (style) => (
                        <Button
                            key={style}
                            size="sm"
                            variant={
                                $displayHidingZonesStyle === style
                                    ? "default"
                                    : "outline"
                            }
                            onClick={() => {
                                selectedZoneId.set("");
                                displayHidingZonesStyle.set(style);
                            }}
                        >
                            {STYLES[style]}
                        </Button>
                    ),
                )}
            </div>
            <p className="text-xs text-muted-foreground">
                Tap a zone to see it on the map. Swipe it sideways to rule it
                out, or back in.
            </p>
            <Input
                placeholder="Search for a station..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
            />
            {shown.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                    {term
                        ? "No hiding zones found."
                        : $isLoading
                          ? "Finding the hiding zones..."
                          : "No hiding zones left."}
                </p>
            ) : (
                <div className="flex flex-col divide-y overflow-hidden rounded-md border">
                    {shown.map((station) => {
                        const id = stationId(station);
                        return (
                            <ZoneRow
                                key={id}
                                id={id}
                                name={String(
                                    extractStationLabel(station.properties),
                                )}
                                ruledOut={$disabledStations.includes(id)}
                                onShow={() => show(id)}
                            />
                        );
                    })}
                </div>
            )}
            <div className="flex gap-2">
                {$disabledStations.length > 0 && (
                    <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => disabledStations.set([])}
                    >
                        Restore all
                    </Button>
                )}
                {$stations.length > 0 && (
                    <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() =>
                            disabledStations.set(
                                _.uniq([
                                    ...$disabledStations,
                                    ...$stations.map(stationId),
                                ]),
                            )
                        }
                    >
                        Rule out all
                    </Button>
                )}
            </div>
        </div>
    );
};

/** One zone: tap to see it, swipe sideways (or the button) to rule it out. */
const ZoneRow = ({
    id,
    name,
    ruledOut,
    onShow,
}: {
    id: string;
    name: string;
    ruledOut: boolean;
    onShow: () => void;
}) => {
    const [offset, setOffset] = useState(0);
    const start = useRef<{ x: number; y: number } | null>(null);
    const swiping = useRef(false);

    return (
        <div
            className={cn(
                "relative",
                Math.abs(offset) > 0 &&
                    (ruledOut ? "bg-green-700" : "bg-red-700"),
            )}
            data-station-id={id}
        >
            {Math.abs(offset) > 0 && (
                <span
                    className={cn(
                        "absolute inset-y-0 flex items-center px-4 text-sm font-semibold text-white",
                        offset > 0 ? "left-0" : "right-0",
                    )}
                >
                    {ruledOut ? "Back in" : "Rule out"}
                </span>
            )}
            <div
                className="relative flex touch-pan-y select-none items-center gap-2 bg-background px-3 py-2"
                style={{
                    transform: `translateX(${offset}px)`,
                    transition: start.current ? "none" : "transform 150ms",
                }}
                data-vaul-no-drag
                onPointerDown={(e) => {
                    start.current = { x: e.clientX, y: e.clientY };
                    swiping.current = false;
                }}
                onPointerMove={(e) => {
                    if (!start.current) return;
                    const dx = e.clientX - start.current.x;
                    const dy = e.clientY - start.current.y;
                    if (
                        !swiping.current &&
                        Math.abs(dx) > 10 &&
                        Math.abs(dx) > Math.abs(dy)
                    ) {
                        swiping.current = true;
                        e.currentTarget.setPointerCapture(e.pointerId);
                    }
                    if (swiping.current) setOffset(dx);
                }}
                onPointerUp={() => {
                    if (swiping.current && Math.abs(offset) >= SWIPE_PX) {
                        toggleZone(id);
                    }
                    start.current = null;
                    setOffset(0);
                }}
                onPointerCancel={() => {
                    start.current = null;
                    swiping.current = false;
                    setOffset(0);
                }}
                onClick={() => {
                    if (swiping.current) return;
                    onShow();
                }}
            >
                <span
                    className={cn(
                        "min-w-0 flex-1 truncate",
                        ruledOut && "text-muted-foreground line-through",
                    )}
                >
                    {name}
                </span>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    title={ruledOut ? "Back in" : "Rule out"}
                    onClick={(e) => {
                        e.stopPropagation();
                        toggleZone(id);
                    }}
                >
                    {ruledOut ? <RotateCcwIcon /> : <XIcon />}
                </Button>
            </div>
        </div>
    );
};

const STATION_TYPES = [
    { label: "Railway Stations", value: "[railway=station]" },
    { label: "Railway Halts", value: "[railway=halt]" },
    { label: "Railway Stops", value: "[railway=stop]" },
    { label: "Tram Stops", value: "[railway=tram_stop]" },
    { label: "Bus Stops", value: "[highway=bus_stop]" },
    { label: "Ferry Terminals", value: "[amenity=ferry_terminal]" },
    {
        label: "Ferry Platforms (public transport)",
        value: "[public_transport=platform][platform=ferry]",
    },
    { label: "Funicular Stations", value: "[railway=funicular]" },
    { label: "Aerialway Stations", value: "[aerialway=station]" },
    {
        label: "Railway Stations Excluding Subways",
        value: "[railway=station][subway!=yes]",
    },
    { label: "Subway Stations", value: "[railway=station][subway=yes]" },
    {
        label: "Light Rail Stations",
        value: "[railway=station][light_rail=yes]",
    },
    { label: "Light Rail Halts", value: "[railway=halt][light_rail=yes]" },
];

const ZoneSettings = () => {
    const $displayHidingZones = useStore(displayHidingZones);
    const $displayHidingZonesOptions = useStore(displayHidingZonesOptions);
    const $hidingRadius = useStore(hidingRadius);
    const $hidingRadiusUnits = useStore(hidingRadiusUnits);
    const $isLoading = useStore(isLoading);
    const useCustomStations = useStore(useCustomStationsAtom);
    const includeDefaultStations = useStore(includeDefaultStationsAtom);
    const onlyCustomStations = useCustomStations && !includeDefaultStations;

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2">
                <Label className="font-semibold font-poppins">
                    Display hiding zones?
                </Label>
                <Checkbox
                    checked={$displayHidingZones}
                    onCheckedChange={(v) => displayHidingZones.set(!!v)}
                    disabled={$isLoading}
                />
            </div>
            <p className="text-xs text-orange-500">
                Hiding zones can slow down your phone.
            </p>
            <div className="flex flex-col gap-2">
                <Label className="font-semibold font-poppins">Stations</Label>
                <MultiSelect
                    options={STATION_TYPES}
                    onValueChange={(values) => {
                        if (
                            !_.isEqual(values, displayHidingZonesOptions.get())
                        ) {
                            displayHidingZonesOptions.set(values);
                        }
                    }}
                    defaultValue={$displayHidingZonesOptions}
                    placeholder="Select allowed places"
                    animation={2}
                    maxCount={3}
                    modalPopover
                    className="!bg-popover bg-opacity-100"
                    disabled={$isLoading || onlyCustomStations}
                />
                {onlyCustomStations && (
                    <p className="text-xs text-muted-foreground">
                        This phone uses its own station list (Settings &gt;
                        Advanced).
                    </p>
                )}
            </div>
            <div className="flex flex-col gap-2">
                <Label className="font-semibold font-poppins">
                    Hiding zone radius
                </Label>
                <div className="flex gap-2">
                    <PositiveNumberInput
                        className="w-24"
                        value={$hidingRadius}
                        onChange={hidingRadius.set}
                        disabled={$isLoading}
                    />
                    <UnitSelect
                        unit={$hidingRadiusUnits}
                        disabled={$isLoading}
                        onChange={(unit) => hidingRadiusUnits.set(unit)}
                    />
                </div>
            </div>
        </div>
    );
};

/** Expert options for the hiding zones, under "Advanced" in the settings. */
export const ZoneExpertSettings = () => {
    const $isLoading = useStore(isLoading);
    const useCustomStations = useStore(useCustomStationsAtom);
    const mergeDuplicates = useStore(mergeDuplicatesAtom);
    const includeDefaultStations = useStore(includeDefaultStationsAtom);
    const $customStations = useStore(customStationsAtom);
    const [importUrl, setImportUrl] = useState("");

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2">
                <Label className="font-semibold font-poppins">
                    Merge duplicated stations?
                </Label>
                <Checkbox
                    checked={mergeDuplicates}
                    onCheckedChange={(v) => mergeDuplicatesAtom.set(!!v)}
                    disabled={$isLoading}
                />
            </div>
            <div className="flex items-center justify-between gap-2">
                <Label className="font-semibold font-poppins">
                    Use custom station list?
                </Label>
                <Checkbox
                    checked={useCustomStations}
                    onCheckedChange={(v) => useCustomStationsAtom.set(!!v)}
                    disabled={$isLoading}
                />
            </div>
            {useCustomStations && (
                <div className="flex flex-col gap-2">
                    <Label className="font-semibold font-poppins leading-5">
                        Import stations from URL (CSV, GeoJSON, KML). This must
                        be a raw file link.
                    </Label>
                    <div className="flex gap-2">
                        <Input
                            placeholder="https://..."
                            value={importUrl}
                            onChange={(e) => setImportUrl(e.target.value)}
                            disabled={$isLoading}
                        />
                        <Button
                            disabled={$isLoading}
                            onClick={async () => {
                                if (!importUrl) return;
                                try {
                                    const res = await fetch(importUrl);
                                    const contentType =
                                        res.headers.get("content-type") ||
                                        undefined;
                                    const text = await res.text();
                                    const parsed = parseCustomStationsFromText(
                                        text,
                                        contentType,
                                    );
                                    if (parsed.length === 0) {
                                        toast.error(
                                            "No stations found in provided URL",
                                        );
                                        return;
                                    }
                                    customStationsAtom.set(parsed);
                                    toast.success(
                                        `Imported ${parsed.length} stations`,
                                    );
                                } catch (e: any) {
                                    toast.error(
                                        `Failed to import from URL: ${e.message || e}`,
                                    );
                                }
                            }}
                        >
                            Import
                        </Button>
                    </div>
                    <Input
                        type="file"
                        multiple
                        accept=".csv,.json,.geojson,.kml,application/json,application/vnd.google-earth.kml+xml,text/csv,application/vnd.google-apps.kml+xml,application/xml,text/xml"
                        onInput={async (e) => {
                            const files = (e.target as HTMLInputElement).files;
                            if (!files || files.length === 0) return;
                            try {
                                const all: any[] = [];
                                for (const file of Array.from(files)) {
                                    const text = await file.text();
                                    all.push(
                                        ...parseCustomStationsFromText(
                                            text,
                                            file.type,
                                        ),
                                    );
                                }
                                if (all.length === 0) {
                                    toast.error(
                                        "No stations found in uploaded files",
                                    );
                                    return;
                                }
                                const unique = _.uniqBy(all, (s) =>
                                    s.id && s.id.includes("/")
                                        ? `id:${s.id}`
                                        : `pt:${s.lat},${s.lng}`,
                                );
                                customStationsAtom.set(unique);
                                toast.success(
                                    `Imported ${unique.length} stations`,
                                );
                            } catch (e: any) {
                                toast.error(
                                    `Failed to import files: ${e.message || e}`,
                                );
                            }
                        }}
                    />
                    <div className="flex items-center justify-between gap-2">
                        <Label className="font-semibold font-poppins">
                            Include default stations with custom list?
                        </Label>
                        <Checkbox
                            checked={includeDefaultStations}
                            onCheckedChange={(v) =>
                                includeDefaultStationsAtom.set(!!v)
                            }
                            disabled={$isLoading}
                        />
                    </div>
                    {$customStations.length > 0 && (
                        <>
                            <div className="text-sm text-muted-foreground">
                                {$customStations.length} custom station
                                {$customStations.length === 1 ? "" : "s"}{" "}
                                imported
                            </div>
                            <Button
                                className="w-full"
                                onClick={() => customStationsAtom.set([])}
                            >
                                Clear Imported
                            </Button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};
