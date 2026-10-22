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
                toast.error(`Invalid hiding zone settings: ${e}`);
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
                    toast.error(`Invalid hiding zone settings: ${e}`);
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
                            "Successfully loaded data from Pastebin link!",
                        );
                    } catch (e) {
                        toast.error(`Invalid data from Pastebin: ${e}`);
                    }
                })
                .catch((error) => {
                    console.error("Failed to fetch from Pastebin:", error);
                    toast.error(
                        `Failed to load from Pastebin: ${error.message}`,
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
                            `Successfully loaded data from ${fetchUrl}`,
                        );
                    } catch (e) {
                        toast.error(`Invalid data from ${fetchUrl}: ${e}`);
                    }
                })
                .catch((error) => {
                    console.error(`Failed to fetch from ${fetchUrl}:`, error);
                    toast.error(
                        `Failed to load from ${fetchUrl}: ${error.message}`,
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
                                name: p.name ?? "Imported preset",
                                type: p.type ?? "custom",
                                data: p.data,
                                createdAt:
                                    p.createdAt ?? new Date().toISOString(),
                            };
                        });
                    if (normalized.length > 0) {
                        customPresets.set(normalized);
                        toast.info(`Imported ${normalized.length} preset(s)`);
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

            toast.success("Hiding zone loaded successfully", {
                autoClose: 2000,
            });
        } catch (e) {
            toast.error(`Invalid hiding zone settings: ${e}`);
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
            toast.success("Hiding zone saved to file", { autoClose: 2000 });
        } catch (e) {
            console.error("Failed to save file:", e);
            toast.error(`Failed to save file: ${e}`);
        }
    };

    const loadFromFile = (file: File) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const result = event.target?.result;
            if (typeof result === "string") {
                loadHidingZone(result);
            } else {
                toast.error("Failed to read file");
            }
        };
        reader.onerror = () => {
            toast.error("Failed to read file");
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
            toast.error(`Failed to prepare data for sharing`);
            return;
        }

        const baseUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}`;
        const shareUrl = `${baseUrl}?${HIDING_ZONE_COMPRESSED_URL_PARAM}=${compressedData}`;

        if (shareUrl.length > 2000) {
            toast.info(
                "The game is too large for a link, saving a file instead.",
            );
            saveToFile();
            return;
        }

        // Show platform native share sheet if possible
        await shareOrFallback(shareUrl).then((result) => {
            console.log(`result ${result}`);
            if (result === false) {
                return toast.error(
                    `Clipboard not supported. Try manually copying/pasting: ${shareUrl}`,
                    { className: "p-0 w-[1000px]" },
                );
            }

            if (result === "clipboard") {
                toast.success("Hiding zone URL copied to clipboard", {
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
                        title="Settings"
                        data-tutorial-id="option-questions-button"
                    >
                        <SettingsIcon className="!size-5" />
                    </Button>
                </DrawerTrigger>
                <DrawerContent>
                    <div className="flex flex-col items-center gap-4 mb-4">
                        <DrawerHeader>
                            <DrawerTitle className="text-4xl font-semibold font-poppins">
                                Settings
                            </DrawerTitle>
                        </DrawerHeader>
                        <div className="overflow-y-auto max-h-[70svh] flex w-full flex-col items-center gap-4 px-6">
                            <NewGameDialog
                                className="h-12 w-full max-w-[320px] text-lg"
                                onStart={() => setOptionsOpen(false)}
                            />
                            <Label>Your role on this phone</Label>
                            <div className="grid w-full max-w-[320px] grid-cols-2 gap-2">
                                {(
                                    [
                                        [false, "I'm seeking"],
                                        [true, "I'm hiding"],
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
                                    Share game
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setOptionsOpen(false);
                                        showTutorial.set(true);
                                    }}
                                >
                                    Help
                                </Button>
                            </div>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className="w-full max-w-[320px] border-red-500/60 text-red-500 hover:bg-red-500/10 hover:text-red-500"
                                        disabled={$questions.length === 0}
                                    >
                                        Delete all questions
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>
                                            Delete all questions?
                                        </AlertDialogTitle>
                                        <AlertDialogDescription>
                                            {$questions.length === 1
                                                ? "The question disappears"
                                                : `All ${$questions.length} questions disappear`}{" "}
                                            from the map. You can undo this
                                            right afterwards.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>
                                            Cancel
                                        </AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={deleteAllQuestionsWithUndo}
                                            className="mb-2 sm:mb-0"
                                        >
                                            Delete All
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
                                Advanced
                                <ChevronDownIcon
                                    className={cn(
                                        "transition-transform",
                                        advancedOpen && "rotate-180",
                                    )}
                                />
                            </Button>
                            {advancedOpen && (
                                <div className="flex w-full max-w-[320px] flex-col gap-6 pb-4">
                                    <AdvancedSection title="Map data">
                                        <Label>Overpass API Host</Label>
                                        <Select
                                            trigger="Overpass API host"
                                            options={{
                                                ...Object.fromEntries(
                                                    Object.entries(
                                                        OVERPASS_HOSTS,
                                                    ).map(([label, url]) => [
                                                        url,
                                                        label,
                                                    ]),
                                                ),
                                                custom: "Custom URL",
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
                                                ? "The other hosts will be used as fallbacks if this one fails."
                                                : "The remaining hosts will be tried as fallbacks if the selected one fails."}
                                        </Hint>
                                        <Button
                                            variant="outline"
                                            disabled={$preloadProgress !== null}
                                            onClick={() => preloadGameData()}
                                        >
                                            Preload map data
                                        </Button>
                                        <Hint>
                                            Loads the data of every question
                                            card for the game area, so answers
                                            don&apos;t have to wait. &quot;New
                                            Game&quot; does this by itself.
                                        </Hint>
                                    </AdvancedSection>
                                    <AdvancedSection title="Map style">
                                        <Select
                                            trigger="Map style"
                                            options={{
                                                voyager: "Standard",
                                                light: "Light",
                                                dark: "Dark",
                                                osmcarto: "OpenStreetMap",
                                            }}
                                            value={$baseTileLayer}
                                            onValueChange={(v) =>
                                                baseTileLayer.set(v as any)
                                            }
                                        />
                                    </AdvancedSection>
                                    <AdvancedSection title="Questions">
                                        <CheckboxRow
                                            label="Show all question types?"
                                            checked={$showAllQuestionTypes}
                                            onChange={showAllQuestionTypes.set}
                                        />
                                        <Hint>
                                            For experts: question cards also
                                            offer tentacles and the variants
                                            that are not part of the Small deck.
                                        </Hint>
                                    </AdvancedSection>
                                    <AdvancedSection title="Game file">
                                        <div className="grid grid-cols-2 gap-2">
                                            <Button
                                                variant="outline"
                                                onClick={saveToFile}
                                            >
                                                Save file
                                            </Button>
                                            <Button
                                                variant="outline"
                                                onClick={() =>
                                                    fileInputRef.current?.click()
                                                }
                                            >
                                                Load file
                                            </Button>
                                        </div>
                                        <Hint>
                                            Saves the game area, questions and
                                            ruled-out zones in a file, or loads
                                            such a file.
                                        </Hint>
                                    </AdvancedSection>
                                    <AdvancedSection title="Game area">
                                        <PlacePicker className="w-full" />
                                        <CheckboxRow
                                            label="Show drawing tools?"
                                            checked={$showDrawingTools}
                                            onChange={showDrawingTools.set}
                                        />
                                        <Hint>
                                            Draw the game area by hand (top left
                                            of the map).
                                        </Hint>
                                    </AdvancedSection>
                                    <AdvancedSection title="Hiding zones">
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
