import { useStore } from "@nanostores/react";
import { ChevronDownIcon, SettingsIcon } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";

import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
} from "@/components/ui/drawer";
import {
    additionalMapGeoLocations,
    baseTileLayer,
    customPresets,
    customStations,
    disabledStations,
    displayHidingZonesOptions,
    hiderMode,
    hidingRadius,
    hidingRadiusUnits,
    hidingZone,
    includeDefaultStations,
    keptZonesRuledOut,
    mapGeoJSON,
    mapGeoLocation,
    overpassCustomHost,
    overpassHost,
    polyGeoJSON,
    questions,
    settingsOpen,
    showAllQuestionTypes,
    showDrawingTools,
    showTutorial,
    triggerLocalRefresh,
    useCustomStations,
} from "@/lib/context";
import { type Language, language, t, useLanguage } from "@/lib/i18n";
import { setRole } from "@/lib/role";
import {
    cn,
    compress,
    decompress,
    fetchFromPastebin,
    shareOrFallback,
} from "@/lib/utils";
import { OVERPASS_HOSTS } from "@/maps/api/constants";
import { preloadGameData, preloadProgress } from "@/maps/preload";
import {
    KILOMETERS_PER_MILE,
    questionsSchema,
    type Units,
} from "@/maps/schema";

import { NewGameDialog } from "./NewGameDialog";
import { PlacePicker } from "./PlacePicker";
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
import { Checkbox } from "./ui/checkbox";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select } from "./ui/select";
import { Separator } from "./ui/separator";
import { deleteAllQuestionsWithUndo } from "./UndoToast";
import { ZoneExpertSettings } from "./ZoneSheet";

const HIDING_ZONE_URL_PARAM = "hz";
const HIDING_ZONE_COMPRESSED_URL_PARAM = "hzc";
const PASTEBIN_URL_PARAM = "pb";
const FETCH_URL_PARAM = "url";

/** German or English on this phone; each name is in its own language. */
const LanguageChoice = () => {
    const $language = useLanguage();
    return (
        <>
            <Label>{t("settings.language")}</Label>
            <div className="grid w-full max-w-[320px] grid-cols-2 gap-2">
                {(
                    [
                        ["de", "Deutsch"],
                        ["en", "English"],
                    ] as [Language, string][]
                ).map(([value, name]) => (
                    <Button
                        key={value}
                        variant={$language === value ? "default" : "outline"}
                        aria-pressed={$language === value}
                        lang={value}
                        onClick={() => language.set(value)}
                    >
                        {name}
                    </Button>
                ))}
            </div>
        </>
    );
};

/** One group of options under "Advanced", with a heading. */
const AdvancedSection = ({
    title,
    children,
}: {
    title: string;
    children: ReactNode;
}) => (
    <section className="flex w-full flex-col gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {title}
        </h3>
        {children}
    </section>
);

/** A switch with its label, like in the zone settings. */
const CheckboxRow = ({
    label,
    checked,
    onChange,
}: {
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
}) => (
    <div className="flex items-center justify-between gap-2">
        <Label className="font-semibold font-poppins">{label}</Label>
        <Checkbox checked={checked} onCheckedChange={(v) => onChange(!!v)} />
    </div>
);

const Hint = ({ children }: { children: ReactNode }) => (
    <p className="text-xs text-muted-foreground">{children}</p>
);

export const OptionDrawers = () => {
    useStore(triggerLocalRefresh);
    useLanguage();
    const $hiderMode = useStore(hiderMode);
    const $hidingZone = useStore(hidingZone);
    const $baseTileLayer = useStore(baseTileLayer);
    const $showDrawingTools = useStore(showDrawingTools);
    const $showAllQuestionTypes = useStore(showAllQuestionTypes);
    const $overpassHost = useStore(overpassHost);
    const $preloadProgress = useStore(preloadProgress);
    const $overpassCustomHost = useStore(overpassCustomHost);
    const $questions = useStore(questions);
    const isOptionsOpen = useStore(settingsOpen);
    const setOptionsOpen = settingsOpen.set;
    const [advancedOpen, setAdvancedOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const params = new URL(window.location.toString()).searchParams;
        const hidingZoneOld = params.get(HIDING_ZONE_URL_PARAM);
        const hidingZoneCompressed = params.get(
            HIDING_ZONE_COMPRESSED_URL_PARAM,
        );
        const pastebinId = params.get(PASTEBIN_URL_PARAM);
        const fetchUrl = params.get(FETCH_URL_PARAM);

        if (hidingZoneOld !== null) {
            // Legacy base64 encoding
            try {
                loadHidingZone(atob(hidingZoneOld));
                // Remove hiding zone parameter after initial load
                window.history.replaceState({}, "", window.location.pathname);
            } catch (e) {
                toast.error(t("game.invalid", { error: String(e) }));
            }
        } else if (hidingZoneCompressed !== null) {
            // Modern compressed format
            decompress(hidingZoneCompressed).then((data) => {
                try {
                    loadHidingZone(data);
                    // Remove hiding zone parameter after initial load
                    window.history.replaceState(
                        {},
                        "",
                        window.location.pathname,
                    );
                } catch (e) {
                    toast.error(t("game.invalid", { error: String(e) }));
                }
            });
        } else if (pastebinId !== null) {
            fetchFromPastebin(pastebinId)
                .then((data) => {
                    try {
                        loadHidingZone(data);
                        // Remove pb parameter after initial load
                        window.history.replaceState(
                            {},
                            "",
                            window.location.pathname,
                        );
                        toast.success(
                            t("game.loadedFrom", { source: "Pastebin" }),
                        );
                    } catch (e) {
                        toast.error(t("game.invalid", { error: String(e) }));
                    }
                })
                .catch((error) => {
                    console.error("Failed to fetch from Pastebin:", error);
                    toast.error(
                        t("game.loadFailed", {
                            source: "Pastebin",
                            error: error.message,
                        }),
                    );
                });
        } else if (fetchUrl !== null) {
            fetch(fetchUrl)
                .then((response) => {
                    if (!response.ok)
                        throw `${response.status} ${response.statusText}`;
                    return response.text();
                })
                .then((data) => {
                    try {
                        loadHidingZone(data);
                        // Remove url parameter after initial load
                        window.history.replaceState(
                            {},
                            "",
                            window.location.pathname,
                        );
                        toast.success(
                            t("game.loadedFrom", { source: fetchUrl }),
                        );
                    } catch (e) {
                        toast.error(t("game.invalid", { error: String(e) }));
                    }
                })
                .catch((error) => {
                    console.error(`Failed to fetch from ${fetchUrl}:`, error);
                    toast.error(
                        t("game.loadFailed", {
                            source: fetchUrl,
                            error: error.message,
                        }),
                    );
                });
        }
    }, []);

    const loadHidingZone = (hidingZone: string) => {
        try {
            const geojson = JSON.parse(hidingZone);

            if (
                geojson.properties &&
                geojson.properties.isHidingZone === true
            ) {
                questions.set(
                    questionsSchema.parse(geojson.properties.questions ?? []),
                );
                mapGeoLocation.set(geojson);
                mapGeoJSON.set(null);
                polyGeoJSON.set(null);

                if (geojson.alternateLocations) {
                    additionalMapGeoLocations.set(geojson.alternateLocations);
                } else {
                    additionalMapGeoLocations.set([]);
                }
            } else {
                if (geojson.questions) {
                    questions.set(questionsSchema.parse(geojson.questions));
                    delete geojson.questions;

                    mapGeoJSON.set(geojson);
                    polyGeoJSON.set(geojson);
                } else {
                    questions.set([]);
                    mapGeoJSON.set(geojson);
                    polyGeoJSON.set(geojson);
                }
            }

            const incomingPresets =
                geojson.presets ?? geojson.properties?.presets;
            if (incomingPresets && Array.isArray(incomingPresets)) {
                try {
                    const normalized = (incomingPresets as any[])
                        .filter((p) => p && p.data)
                        .map((p) => {
                            return {
                                id:
                                    p.id ??
                                    (typeof crypto !== "undefined" &&
                                    typeof (crypto as any).randomUUID ===
                                        "function"
                                        ? (crypto as any).randomUUID()
                                        : String(Date.now()) + Math.random()),
                                name: p.name ?? t("game.presetName"),
                                type: p.type ?? "custom",
                                data: p.data,
                                createdAt:
                                    p.createdAt ?? new Date().toISOString(),
                            };
                        });
                    if (normalized.length > 0) {
                        customPresets.set(normalized);
                        toast.info(
                            t("game.presetsImported", {
                                count: normalized.length,
                            }),
                        );
                    }
                } catch (err) {
                    console.warn("Failed to import presets", err);
                }
            }

            if (
                geojson.disabledStations !== null &&
                geojson.disabledStations.constructor === Array
            ) {
                disabledStations.set(geojson.disabledStations);
                keptZonesRuledOut.set([]);
            }

            if (typeof geojson.hidingRadius === "number") {
                // Older versions measured hiding zones in miles
                const units: Units = geojson.hidingRadiusUnits ?? "miles";
                if (units === "miles") {
                    hidingRadius.set(
                        Math.round(
                            geojson.hidingRadius * KILOMETERS_PER_MILE * 1000,
                        ),
                    );
                    hidingRadiusUnits.set("meters");
                } else {
                    hidingRadius.set(geojson.hidingRadius);
                    hidingRadiusUnits.set(units);
                }
            }

            if (geojson.zoneOptions) {
                displayHidingZonesOptions.set(geojson.zoneOptions ?? []);
            }

            if (typeof geojson.useCustomStations === "boolean") {
                useCustomStations.set(geojson.useCustomStations);
            }

            if (
                geojson.customStations &&
                geojson.customStations.constructor === Array
            ) {
                customStations.set(geojson.customStations);
            }

            if (typeof geojson.includeDefaultStations === "boolean") {
                includeDefaultStations.set(geojson.includeDefaultStations);
            }

            toast.success(t("game.loaded"), {
                autoClose: 2000,
            });
        } catch (e) {
            toast.error(t("game.invalid", { error: String(e) }));
        }
    };

    const saveToFile = () => {
        try {
            const data = JSON.stringify($hidingZone, null, 2);
            const blob = new Blob([data], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            const timestamp = new Date()
                .toISOString()
                .replace(/[:.]/g, "-")
                .slice(0, 19);
            a.download = `jetlag-hiding-zone-${timestamp}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast.success(t("game.saved"), { autoClose: 2000 });
        } catch (e) {
            console.error("Failed to save file:", e);
            toast.error(t("game.saveFailed", { error: String(e) }));
        }
    };

    const loadFromFile = (file: File) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const result = event.target?.result;
            if (typeof result === "string") {
                loadHidingZone(result);
            } else {
                toast.error(t("game.readFailed"));
            }
        };
        reader.onerror = () => {
            toast.error(t("game.readFailed"));
        };
        reader.readAsText(file);
    };

    const share = async () => {
        const hidingZoneString = JSON.stringify($hidingZone);
        let compressedData;
        try {
            compressedData = await compress(hidingZoneString);
        } catch (error) {
            console.error("Compression failed:", error);
            toast.error(t("game.shareFailed"));
            return;
        }

        const baseUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}`;
        const shareUrl = `${baseUrl}?${HIDING_ZONE_COMPRESSED_URL_PARAM}=${compressedData}`;

        if (shareUrl.length > 2000) {
            toast.info(t("game.tooLarge"));
            saveToFile();
            return;
        }

        // Show platform native share sheet if possible
        await shareOrFallback(shareUrl).then((result) => {
            console.log(`result ${result}`);
            if (result === false) {
                return toast.error(t("game.copyByHand", { link: shareUrl }), {
                    className: "p-0 w-[1000px]",
                });
            }

            if (result === "clipboard") {
                toast.success(t("game.linkCopied"), {
                    autoClose: 2000,
                });
            }
        });
    };

    return (
        <>
            <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) loadFromFile(file);
                    e.target.value = "";
                }}
            />
            <Drawer open={isOptionsOpen} onOpenChange={setOptionsOpen}>
                <DrawerTrigger asChild>
                    <Button
                        size="icon"
                        variant="outline"
                        className="h-11 w-11 rounded-full bg-background/95 text-foreground shadow-lg"
                        title={t("settings.title")}
                        data-tutorial-id="option-questions-button"
                    >
                        <SettingsIcon className="!size-5" />
                    </Button>
                </DrawerTrigger>
                <DrawerContent>
                    <div className="flex flex-col items-center gap-4 mb-4">
                        <DrawerHeader>
                            <DrawerTitle className="text-4xl font-semibold font-poppins">
                                {t("settings.title")}
                            </DrawerTitle>
                        </DrawerHeader>
                        <div className="overflow-y-auto max-h-[70svh] flex w-full flex-col items-center gap-4 px-6">
                            <NewGameDialog
                                className="h-12 w-full max-w-[320px] text-lg"
                                onStart={() => setOptionsOpen(false)}
                            />
                            <Label>{t("role.label")}</Label>
                            <div className="grid w-full max-w-[320px] grid-cols-2 gap-2">
                                {(
                                    [
                                        [false, t("role.seeking")],
                                        [true, t("role.hiding")],
                                    ] as const
                                ).map(([hider, label]) => {
                                    const active =
                                        ($hiderMode !== false) === hider;
                                    return (
                                        <Button
                                            key={label}
                                            variant={
                                                active ? "default" : "outline"
                                            }
                                            className={cn(
                                                active &&
                                                    (hider
                                                        ? "bg-violet-700 text-white hover:bg-violet-800"
                                                        : "bg-blue-600 text-white hover:bg-blue-700"),
                                            )}
                                            aria-pressed={active}
                                            onClick={() => {
                                                if (active) return;
                                                setOptionsOpen(false);
                                                setRole(
                                                    hider ? "hider" : "seeker",
                                                );
                                            }}
                                        >
                                            {label}
                                        </Button>
                                    );
                                })}
                            </div>
                            <LanguageChoice />
                            <div className="grid w-full max-w-[320px] grid-cols-2 gap-2">
                                <Button
                                    variant="outline"
                                    onClick={share}
                                    data-tutorial-id="share-questions-button"
                                >
                                    {t("settings.share")}
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setOptionsOpen(false);
                                        showTutorial.set(true);
                                    }}
                                >
                                    {t("settings.help")}
                                </Button>
                            </div>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className="w-full max-w-[320px] border-red-500/60 text-red-500 hover:bg-red-500/10 hover:text-red-500"
                                        disabled={$questions.length === 0}
                                    >
                                        {t("settings.deleteAll")}
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>
                                            {t("settings.deleteAllTitle")}
                                        </AlertDialogTitle>
                                        <AlertDialogDescription>
                                            {$questions.length === 1
                                                ? t("card.deleteText")
                                                : t("settings.deleteAllText", {
                                                      count: $questions.length,
                                                  })}
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>
                                            {t("common.cancel")}
                                        </AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={deleteAllQuestionsWithUndo}
                                            className="mb-2 sm:mb-0"
                                        >
                                            {t("settings.deleteAllButton")}
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                            <Separator className="w-full max-w-[320px]" />
                            <Button
                                variant="ghost"
                                className="w-full max-w-[320px] justify-between text-muted-foreground"
                                aria-expanded={advancedOpen}
                                onClick={() => setAdvancedOpen(!advancedOpen)}
                            >
                                {t("settings.advanced")}
                                <ChevronDownIcon
                                    className={cn(
                                        "transition-transform",
                                        advancedOpen && "rotate-180",
                                    )}
                                />
                            </Button>
                            {advancedOpen && (
                                <div className="flex w-full max-w-[320px] flex-col gap-6 pb-4">
                                    <AdvancedSection
                                        title={t("settings.mapData")}
                                    >
                                        <Label>
                                            {t("settings.overpassHost")}
                                        </Label>
                                        <Select
                                            trigger={t("settings.overpassHost")}
                                            options={{
                                                ...Object.fromEntries(
                                                    Object.entries(
                                                        OVERPASS_HOSTS,
                                                    ).map(([label, url]) => [
                                                        url,
                                                        label,
                                                    ]),
                                                ),
                                                custom: t("settings.customUrl"),
                                            }}
                                            value={$overpassHost}
                                            onValueChange={(v) =>
                                                overpassHost.set(v as any)
                                            }
                                        />
                                        {$overpassHost === "custom" && (
                                            <Input
                                                type="text"
                                                value={$overpassCustomHost}
                                                onChange={(e) =>
                                                    overpassCustomHost.set(
                                                        e.target.value,
                                                    )
                                                }
                                                placeholder="https://your-overpass-instance/api/interpreter"
                                            />
                                        )}
                                        <Hint>
                                            {$overpassHost === "custom"
                                                ? t("settings.customFallback")
                                                : t("settings.fallback")}
                                        </Hint>
                                        <Button
                                            variant="outline"
                                            disabled={$preloadProgress !== null}
                                            onClick={() => preloadGameData()}
                                        >
                                            {t("settings.preload")}
                                        </Button>
                                        <Hint>{t("settings.preloadHint")}</Hint>
                                    </AdvancedSection>
                                    <AdvancedSection
                                        title={t("settings.mapStyle")}
                                    >
                                        <Select
                                            trigger={t("settings.mapStyle")}
                                            options={{
                                                voyager: t(
                                                    "settings.style.standard",
                                                ),
                                                light: t(
                                                    "settings.style.light",
                                                ),
                                                dark: t("settings.style.dark"),
                                                osmcarto: "OpenStreetMap",
                                            }}
                                            value={$baseTileLayer}
                                            onValueChange={(v) =>
                                                baseTileLayer.set(v as any)
                                            }
                                        />
                                    </AdvancedSection>
                                    <AdvancedSection
                                        title={t("settings.questions")}
                                    >
                                        <CheckboxRow
                                            label={t("settings.allTypes")}
                                            checked={$showAllQuestionTypes}
                                            onChange={showAllQuestionTypes.set}
                                        />
                                        <Hint>
                                            {t("settings.allTypesHint")}
                                        </Hint>
                                    </AdvancedSection>
                                    <AdvancedSection
                                        title={t("settings.gameFile")}
                                    >
                                        <div className="grid grid-cols-2 gap-2">
                                            <Button
                                                variant="outline"
                                                onClick={saveToFile}
                                            >
                                                {t("settings.saveFile")}
                                            </Button>
                                            <Button
                                                variant="outline"
                                                onClick={() =>
                                                    fileInputRef.current?.click()
                                                }
                                            >
                                                {t("settings.loadFile")}
                                            </Button>
                                        </div>
                                        <Hint>
                                            {t("settings.gameFileHint")}
                                        </Hint>
                                    </AdvancedSection>
                                    <AdvancedSection
                                        title={t("settings.gameArea")}
                                    >
                                        <PlacePicker className="w-full" />
                                        <CheckboxRow
                                            label={t("settings.drawingTools")}
                                            checked={$showDrawingTools}
                                            onChange={showDrawingTools.set}
                                        />
                                        <Hint>{t("settings.drawingHint")}</Hint>
                                    </AdvancedSection>
                                    <AdvancedSection
                                        title={t("settings.hidingZones")}
                                    >
                                        <ZoneExpertSettings />
                                    </AdvancedSection>
                                </div>
                            )}
                        </div>
                    </div>
                </DrawerContent>
            </Drawer>
        </>
    );
};
