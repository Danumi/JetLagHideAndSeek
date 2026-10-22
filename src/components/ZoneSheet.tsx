import { useStore } from "@nanostores/react";
import _ from "lodash";
import {
    ChevronLeftIcon,
    RotateCcwIcon,
    SettingsIcon,
    XIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
    hiderMode,
    hidingRadius,
    hidingRadiusUnits,
    includeDefaultStations as includeDefaultStationsAtom,
    isLoading,
    keptZonesRuledOut,
    trainStations,
    useCustomStations as useCustomStationsAtom,
    zoneSheetOpen,
} from "@/lib/context";
import { type MessageKey, t, useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { parseCustomStationsFromText } from "@/maps/api";
import { extractStationLabel } from "@/maps/geo-utils";
import {
    canShowAllZones,
    showAllZones,
    showZone,
    stationId,
    toggleZone,
    zonesLeft,
} from "@/maps/zones";

import { PositiveNumberInput } from "./PositiveNumberInput";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { MultiSelect } from "./ui/multi-select";
import { keepOnlyZonesWithUndo } from "./UndoToast";
import { UnitSelect } from "./UnitSelect";

/** A sideways swipe this far rules a zone out (or back in). */
const SWIPE_PX = 80;

const STYLES = {
    zones: "zones.style.zones",
    stations: "zones.style.stations",
    "no-overlap": "zones.style.merged",
    "no-display": "zones.style.hidden",
} as const satisfies Record<string, MessageKey>;

/** The list of hiding zones, from the "Zones" button at the bottom. */
export const ZoneSheet = () => {
    useLanguage();
    const $open = useStore(zoneSheetOpen);
    const $stations = useStore(trainStations);
    const $disabledStations = useStore(disabledStations);
    const $allTrainStations = useStore(allTrainStations);
    const $displayHidingZones = useStore(displayHidingZones);
    const [settings, setSettings] = useState(false);

    // "Zones" always opens the list, not the settings shown last time
    useEffect(() => {
        if ($open) setSettings(false);
    }, [$open]);

    const left = zonesLeft($stations, $disabledStations).length;

    return (
        <Drawer open={$open} onOpenChange={zoneSheetOpen.set}>
            <DrawerContent className="max-h-[85svh]">
                <div className="mx-auto flex min-h-0 w-full max-w-lg flex-col overflow-hidden">
                    <DrawerHeader className="text-left">
                        <div className="flex items-center gap-2">
                            {settings && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setSettings(false)}
                                    title={t("common.back")}
                                >
                                    <ChevronLeftIcon />
                                </Button>
                            )}
                            <DrawerTitle className="flex-1 text-2xl font-semibold font-poppins">
                                {settings
                                    ? t("zones.settingsTitle")
                                    : t("zones.title")}
                            </DrawerTitle>
                            {!settings && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setSettings(true)}
                                >
                                    <SettingsIcon />
                                    {t("zones.settings")}
                                </Button>
                            )}
                        </div>
                        <DrawerDescription>
                            {settings
                                ? t("zones.settingsText")
                                : $displayHidingZones
                                  ? t("zones.left", {
                                        left,
                                        total: $allTrainStations.length,
                                    })
                                  : t("zones.off")}
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
    const $keptZonesRuledOut = useStore(keptZonesRuledOut);
    const $displayHidingZones = useStore(displayHidingZones);
    const $displayHidingZonesStyle = useStore(displayHidingZonesStyle);
    const $hiderMode = useStore(hiderMode);
    const $isLoading = useStore(isLoading);
    const [search, setSearch] = useState("");
    // "Keep only these": the zones ticked so far, or null
    const [keeping, setKeeping] = useState<string[] | null>(null);

    if (!$displayHidingZones) {
        return (
            <Button
                className="w-full"
                onClick={() => displayHidingZones.set(true)}
            >
                {t("zones.turnOn")}
            </Button>
        );
    }

    const term = search.trim().toLowerCase();
    const listed = keeping
        ? zonesLeft($stations, $disabledStations)
        : $stations;
    const shown = term
        ? listed.filter((station) =>
              String(extractStationLabel(station.properties))
                  .toLowerCase()
                  .includes(term),
          )
        : listed;

    const show = (id: string) => {
        zoneSheetOpen.set(false);
        showZone(id);
    };
    const tick = (id: string) =>
        setKeeping((ticked) =>
            ticked?.includes(id)
                ? ticked.filter((x) => x !== id)
                : [...(ticked ?? []), id],
        );
    const keep = (ids: string[]) => {
        keepOnlyZonesWithUndo(ids);
        setKeeping(null);
        setSearch("");
    };

    return (
        <div className="flex flex-col gap-3">
            {keeping ? (
                <p className="text-sm">{t("zones.keepHelp")}</p>
            ) : (
                <>
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
                                    onClick={() =>
                                        displayHidingZonesStyle.set(style)
                                    }
                                >
                                    {t(STYLES[style])}
                                </Button>
                            ),
                        )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {t("zones.listHelp")}
                    </p>
                </>
            )}
            <div className="flex gap-2">
                <Input
                    placeholder={t("zones.search")}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                {!keeping && $hiderMode === false && (
                    <Button
                        variant="outline"
                        className="shrink-0"
                        disabled={
                            zonesLeft($stations, $disabledStations).length < 2
                        }
                        onClick={() => setKeeping([])}
                    >
                        {t("zones.keepOnly")}
                    </Button>
                )}
            </div>
            {shown.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                    {term
                        ? t("zones.notFound")
                        : $isLoading
                          ? t("zones.finding")
                          : t("zones.noneLeft")}
                </p>
            ) : (
                <div className="flex flex-col divide-y overflow-hidden rounded-md border">
                    {shown.map((station) => {
                        const id = stationId(station);
                        const name = String(
                            extractStationLabel(station.properties),
                        );
                        return keeping ? (
                            <label
                                key={id}
                                className="flex cursor-pointer select-none items-center gap-3 px-3 py-2"
                            >
                                <Checkbox
                                    checked={keeping.includes(id)}
                                    onCheckedChange={() => tick(id)}
                                />
                                <span className="min-w-0 flex-1 truncate">
                                    {name}
                                </span>
                            </label>
                        ) : (
                            <ZoneRow
                                key={id}
                                id={id}
                                name={name}
                                ruledOut={$disabledStations.includes(id)}
                                onShow={() => show(id)}
                            />
                        );
                    })}
                </div>
            )}
            {keeping ? (
                <div className="sticky bottom-0 flex gap-2 bg-background py-2">
                    <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => setKeeping(null)}
                    >
                        {t("common.cancel")}
                    </Button>
                    <Button
                        className="flex-1"
                        disabled={keeping.length === 0}
                        onClick={() => keep(keeping)}
                    >
                        {keeping.length === 1
                            ? t("zones.keepThis")
                            : t("zones.keepThese", { count: keeping.length })}
                    </Button>
                </div>
            ) : (
                <div className="flex gap-2">
                    {canShowAllZones($disabledStations, $keptZonesRuledOut) ? (
                        <Button
                            variant="outline"
                            className="flex-1"
                            onClick={showAllZones}
                        >
                            {t("zones.showAll")}
                        </Button>
                    ) : (
                        $disabledStations.length > 0 && (
                            <Button
                                variant="outline"
                                className="flex-1"
                                onClick={() => {
                                    disabledStations.set([]);
                                    keptZonesRuledOut.set([]);
                                }}
                            >
                                {t("zones.restoreAll")}
                            </Button>
                        )
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
                            {t("zones.ruleOutAll")}
                        </Button>
                    )}
                </div>
            )}
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
                    {ruledOut ? t("zones.backIn") : t("zones.ruleOut")}
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
                    title={ruledOut ? t("zones.backIn") : t("zones.ruleOut")}
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

const STATION_TYPES: { label: MessageKey; value: string }[] = [
    { label: "stationType.railway", value: "[railway=station]" },
    { label: "stationType.halt", value: "[railway=halt]" },
    { label: "stationType.stop", value: "[railway=stop]" },
    { label: "stationType.tram", value: "[railway=tram_stop]" },
    { label: "stationType.bus", value: "[highway=bus_stop]" },
    { label: "stationType.ferry", value: "[amenity=ferry_terminal]" },
    {
        label: "stationType.ferryPlatform",
        value: "[public_transport=platform][platform=ferry]",
    },
    { label: "stationType.funicular", value: "[railway=funicular]" },
    { label: "stationType.aerialway", value: "[aerialway=station]" },
    {
        label: "stationType.noSubway",
        value: "[railway=station][subway!=yes]",
    },
    { label: "stationType.subway", value: "[railway=station][subway=yes]" },
    {
        label: "stationType.lightRail",
        value: "[railway=station][light_rail=yes]",
    },
    {
        label: "stationType.lightRailHalt",
        value: "[railway=halt][light_rail=yes]",
    },
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
                    {t("zones.display")}
                </Label>
                <Checkbox
                    checked={$displayHidingZones}
                    onCheckedChange={(v) => displayHidingZones.set(!!v)}
                    disabled={$isLoading}
                />
            </div>
            <p className="text-xs text-orange-500">{t("zones.slow")}</p>
            <div className="flex flex-col gap-2">
                <Label className="font-semibold font-poppins">
                    {t("zones.stations")}
                </Label>
                <MultiSelect
                    options={STATION_TYPES.map(({ label, value }) => ({
                        label: t(label),
                        value,
                    }))}
                    onValueChange={(values) => {
                        if (
                            !_.isEqual(values, displayHidingZonesOptions.get())
                        ) {
                            displayHidingZonesOptions.set(values);
                        }
                    }}
                    defaultValue={$displayHidingZonesOptions}
                    placeholder={t("zones.stationTypes")}
                    animation={2}
                    maxCount={3}
                    modalPopover
                    className="!bg-popover bg-opacity-100"
                    disabled={$isLoading || onlyCustomStations}
                />
                {onlyCustomStations && (
                    <p className="text-xs text-muted-foreground">
                        {t("zones.ownList")}
                    </p>
                )}
            </div>
            <div className="flex flex-col gap-2">
                <Label className="font-semibold font-poppins">
                    {t("zones.radius")}
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
    const includeDefaultStations = useStore(includeDefaultStationsAtom);
    const $customStations = useStore(customStationsAtom);
    const [importUrl, setImportUrl] = useState("");

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2">
                <Label className="font-semibold font-poppins">
                    {t("stations.useOwn")}
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
                        {t("stations.importUrl")}
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
                                        toast.error(t("stations.noneAtUrl"));
                                        return;
                                    }
                                    customStationsAtom.set(parsed);
                                    toast.success(
                                        t("stations.imported", {
                                            count: parsed.length,
                                        }),
                                    );
                                } catch (e: any) {
                                    toast.error(
                                        t("stations.urlFailed", {
                                            error: e.message || String(e),
                                        }),
                                    );
                                }
                            }}
                        >
                            {t("stations.import")}
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
                                    toast.error(t("stations.noneInFiles"));
                                    return;
                                }
                                const unique = _.uniqBy(all, (s) =>
                                    s.id && s.id.includes("/")
                                        ? `id:${s.id}`
                                        : `pt:${s.lat},${s.lng}`,
                                );
                                customStationsAtom.set(unique);
                                toast.success(
                                    t("stations.imported", {
                                        count: unique.length,
                                    }),
                                );
                            } catch (e: any) {
                                toast.error(
                                    t("stations.filesFailed", {
                                        error: e.message || String(e),
                                    }),
                                );
                            }
                        }}
                    />
                    <div className="flex items-center justify-between gap-2">
                        <Label className="font-semibold font-poppins">
                            {t("stations.includeDefault")}
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
                                {$customStations.length === 1
                                    ? t("stations.importedOne")
                                    : t("stations.importedMany", {
                                          count: $customStations.length,
                                      })}
                            </div>
                            <Button
                                className="w-full"
                                onClick={() => customStationsAtom.set([])}
                            >
                                {t("stations.clear")}
                            </Button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};
