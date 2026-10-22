import { useStore } from "@nanostores/react";
import * as turf from "@turf/turf";
import { ChevronLeftIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { TbMessage2Question } from "react-icons/tb";
import { toast } from "react-toastify";

import { Button } from "@/components/ui/button";
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import {
    addQuestion,
    displayHidingZones,
    isLoading,
    leafletMapContext,
    questions,
    thermometerRun,
} from "@/lib/context";
import {
    getCurrentPosition,
    type LatLng,
    questionLocation,
    showQuestion,
} from "@/lib/gps";
import { cn } from "@/lib/utils";
import { isPending, questionTitle } from "@/maps/answers";
import {
    cardQuestionData,
    type DeckCard,
    deckGroups,
    MATCHING_DECK,
    MEASURING_DECK,
    RADAR_DISTANCES,
    THERMOMETER_DISTANCES,
} from "@/maps/deck";

const KINDS = {
    matching: {
        label: "Matching",
        question: "Is your nearest ___ the same as mine?",
    },
    measuring: {
        label: "Measuring",
        question: "Compared to me, are you closer to or further from ___?",
    },
    radar: { label: "Radar", question: "Are you within ___ of me?" },
    thermometer: {
        label: "Thermometer",
        question: "After traveling ___, am I hotter or colder?",
    },
} as const;

type Kind = keyof typeof KINDS;

const formatDistance = (kilometers: number) =>
    kilometers < 1
        ? `${Math.round(kilometers * 1000)} m`
        : `${kilometers.toFixed(2)} km`;

/** The big "Ask a question" button, or the running thermometer. */
export const AskQuestion = () => {
    const $thermometerRun = useStore(thermometerRun);

    return (
        <div className="flex flex-col items-center gap-2">
            <WaitingForAnswer />
            {$thermometerRun ? (
                <ThermometerTracker run={$thermometerRun} />
            ) : (
                <AskQuestionDrawer />
            )}
        </div>
    );
};

/** Reminder of questions without an answer; opens the first one. */
const WaitingForAnswer = () => {
    const $questions = useStore(questions);
    const pending = $questions.filter(isPending);

    if (pending.length === 0) return null;

    return (
        <button
            className="max-w-[92vw] truncate rounded-full bg-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-lg hover:bg-orange-600"
            onClick={() => showQuestion(pending[0].key)}
        >
            {pending.length === 1
                ? `Enter answer: ${questionTitle(pending[0])}`
                : `${pending.length} questions waiting for an answer`}
        </button>
    );
};

const AskQuestionDrawer = () => {
    const $isLoading = useStore(isLoading);
    const $displayHidingZones = useStore(displayHidingZones);
    const [open, setOpen] = useState(false);
    const [kind, setKind] = useState<Kind | null>(null);
    const [busy, setBusy] = useState(false);
    const [otherKilometers, setOtherKilometers] = useState("");

    const ask = async (data: (at: LatLng) => any) => {
        setBusy(true);
        try {
            const at = await questionLocation();
            if (!at) return;
            const key = Math.random();
            addQuestion({ key, ...data(at) });
            setOpen(false);
            showQuestion(key);
        } finally {
            setBusy(false);
        }
    };

    const askCard = (id: "matching" | "measuring", card: DeckCard) =>
        ask((at) => ({
            id,
            data: { lat: at.lat, lng: at.lng, ...cardQuestionData(card) },
        }));

    const askRadar = (radius: number, unit: "meters" | "kilometers") =>
        ask((at) => ({
            id: "radius",
            data: { lat: at.lat, lng: at.lng, radius, unit },
        }));

    const startThermometer = async (kilometers: number) => {
        setBusy(true);
        const at = await toast.promise(getCurrentPosition(), {
            pending: "Getting your location...",
        });
        setBusy(false);

        if (at) {
            thermometerRun.set({ latA: at.lat, lngA: at.lng, kilometers });
            setOpen(false);
            return;
        }

        // Without GPS the seekers place both markers by hand
        const map = leafletMapContext.get();
        if (!map) return;
        const center = map.getCenter();
        const end = turf.destination([center.lng, center.lat], kilometers, 90, {
            units: "kilometers",
        });
        const key = Math.random();
        addQuestion({
            id: "thermometer",
            key,
            data: {
                latA: center.lat,
                lngA: center.lng,
                latB: end.geometry.coordinates[1],
                lngB: end.geometry.coordinates[0],
            },
        });
        toast.warning(
            "Couldn't get your location. Drag the start and end markers to where you started and stopped.",
            { autoClose: 6000 },
        );
        setOpen(false);
        showQuestion(key);
    };

    const cardButton = (id: "matching" | "measuring", card: DeckCard) => {
        const needsZones = card.needsHidingZones && !$displayHidingZones;
        const note = card.noAnswer
            ? `No answer in Vienna. ${card.noAnswer}`
            : needsZones
              ? "Turn on hiding zones first (right sidebar)."
              : card.hint;

        return (
            <button
                key={card.id}
                className={cn(
                    "w-full rounded-md border px-3 py-2 text-left transition-colors",
                    "hover:bg-accent active:bg-accent disabled:opacity-60",
                )}
                disabled={busy || !!card.noAnswer || needsZones}
                onClick={() => askCard(id, card)}
            >
                <div className="font-semibold">{card.label}</div>
                {note && (
                    <div
                        className={cn(
                            "text-xs text-muted-foreground",
                            (card.noAnswer || needsZones) && "text-orange-500",
                        )}
                    >
                        {note}
                    </div>
                )}
            </button>
        );
    };

    let content;
    switch (kind) {
        case null:
            content = (
                <div className="grid grid-cols-2 gap-3">
                    {(Object.keys(KINDS) as Kind[]).map((k) => (
                        <button
                            key={k}
                            className="flex min-h-28 flex-col justify-center gap-1 rounded-lg border p-3 text-left transition-colors hover:bg-accent active:bg-accent"
                            onClick={() => setKind(k)}
                        >
                            <span className="text-xl font-semibold font-poppins">
                                {KINDS[k].label}
                            </span>
                            <span className="text-xs text-muted-foreground">
                                {KINDS[k].question}
                            </span>
                        </button>
                    ))}
                </div>
            );
            break;
        case "matching":
        case "measuring":
            content = (
                <div className="flex flex-col gap-4">
                    {deckGroups(
                        kind === "matching" ? MATCHING_DECK : MEASURING_DECK,
                    ).map(({ group, cards }) => (
                        <div key={group} className="flex flex-col gap-2">
                            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                                {group}
                            </h3>
                            {cards.map((card) => cardButton(kind, card))}
                        </div>
                    ))}
                </div>
            );
            break;
        case "radar":
            content = (
                <div className="flex flex-col gap-4">
                    <div className="grid grid-cols-3 gap-2">
                        {RADAR_DISTANCES.map((distance) => (
                            <Button
                                key={distance.label}
                                variant="outline"
                                className="h-14 text-lg"
                                disabled={busy}
                                onClick={() =>
                                    askRadar(distance.radius, distance.unit)
                                }
                            >
                                {distance.label}
                            </Button>
                        ))}
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm">Choose:</span>
                        <Input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            className="w-24"
                            value={otherKilometers}
                            onChange={(e) => setOtherKilometers(e.target.value)}
                        />
                        <span className="text-sm">km</span>
                        <Button
                            disabled={
                                busy ||
                                !(
                                    parseFloat(
                                        otherKilometers.replace(",", "."),
                                    ) > 0
                                )
                            }
                            onClick={() =>
                                askRadar(
                                    parseFloat(
                                        otherKilometers.replace(",", "."),
                                    ),
                                    "kilometers",
                                )
                            }
                        >
                            Ask
                        </Button>
                    </div>
                </div>
            );
            break;
        case "thermometer":
            content = (
                <div className="flex flex-col gap-3">
                    <p className="text-sm text-muted-foreground">
                        Starts at your current location. Send it to the hider,
                        then travel; the app shows the distance as the crow
                        flies. Tap &quot;Set end here&quot; when you are far
                        enough.
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                        {THERMOMETER_DISTANCES.map((distance) => (
                            <Button
                                key={distance.label}
                                variant="outline"
                                className="h-16 text-lg"
                                disabled={busy}
                                onClick={() =>
                                    startThermometer(distance.kilometers)
                                }
                            >
                                Start {distance.label}
                            </Button>
                        ))}
                    </div>
                </div>
            );
            break;
    }

    return (
        <Drawer
            open={open}
            onOpenChange={(value) => {
                setOpen(value);
                if (value) setKind(null);
            }}
        >
            <DrawerTrigger asChild>
                <Button
                    className="h-14 rounded-full bg-blue-600 px-6 text-lg font-semibold text-white shadow-lg hover:bg-blue-700"
                    disabled={$isLoading}
                >
                    <TbMessage2Question className="!size-6" />
                    Ask a question
                </Button>
            </DrawerTrigger>
            <DrawerContent className="max-h-[90vh]">
                <div className="mx-auto flex w-full max-w-lg flex-col overflow-hidden">
                    <DrawerHeader className="text-left">
                        <div className="flex items-center gap-2">
                            {kind && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setKind(null)}
                                    title="Back"
                                >
                                    <ChevronLeftIcon />
                                </Button>
                            )}
                            <DrawerTitle className="text-2xl font-semibold font-poppins">
                                {kind ? KINDS[kind].label : "Ask a question"}
                            </DrawerTitle>
                        </div>
                        <DrawerDescription>
                            {kind
                                ? KINDS[kind].question
                                : "The question starts at your GPS location."}
                        </DrawerDescription>
                    </DrawerHeader>
                    <div className="overflow-y-auto px-4 pb-6">{content}</div>
                </div>
            </DrawerContent>
        </Drawer>
    );
};

const ThermometerTracker = ({
    run,
}: {
    run: { latA: number; lngA: number; kilometers: number };
}) => {
    const [position, setPosition] = useState<LatLng | null>(null);
    const [noSignal, setNoSignal] = useState(false);

    useEffect(() => {
        if (typeof navigator === "undefined" || !navigator.geolocation) {
            setNoSignal(true);
            return;
        }
        const id = navigator.geolocation.watchPosition(
            (p) => {
                setPosition({
                    lat: p.coords.latitude,
                    lng: p.coords.longitude,
                });
                setNoSignal(false);
            },
            () => setNoSignal(true),
            { enableHighAccuracy: true, maximumAge: 5_000 },
        );
        return () => navigator.geolocation.clearWatch(id);
    }, []);

    const target =
        run.kilometers < 1
            ? formatDistance(run.kilometers)
            : `${run.kilometers} km`;
    const traveled = position
        ? turf.distance([run.lngA, run.latA], [position.lng, position.lat], {
              units: "kilometers",
          })
        : 0;
    const reached = traveled >= run.kilometers;

    const finish = (end: LatLng) => {
        const key = Math.random();
        addQuestion({
            id: "thermometer",
            key,
            data: {
                latA: run.latA,
                lngA: run.lngA,
                latB: end.lat,
                lngB: end.lng,
            },
        });
        thermometerRun.set(null);
        showQuestion(key);
    };

    return (
        <div className="flex w-[min(92vw,420px)] flex-col gap-2 rounded-lg border bg-background p-3 text-foreground shadow-lg">
            <div className="flex items-baseline justify-between">
                <span className="font-semibold font-poppins">
                    Thermometer {target}
                </span>
                <span className="text-xs text-muted-foreground">
                    as the crow flies
                </span>
            </div>
            <div className="text-2xl font-semibold">
                {position
                    ? `${formatDistance(traveled)} of ${target}`
                    : noSignal
                      ? "No GPS signal"
                      : "Waiting for GPS..."}
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                    className={cn(
                        "h-full transition-all",
                        reached ? "bg-green-600" : "bg-blue-600",
                    )}
                    style={{
                        width: `${Math.min(100, (traveled / run.kilometers) * 100)}%`,
                    }}
                />
            </div>
            <div className="flex gap-2">
                <Button
                    className={cn(
                        "h-12 flex-1 text-base",
                        reached && "bg-green-600 text-white hover:bg-green-700",
                    )}
                    variant={reached ? "default" : "outline"}
                    disabled={!position}
                    onClick={() => {
                        if (
                            !reached &&
                            !window.confirm(
                                `You have traveled ${formatDistance(traveled)}, the card needs ${target}. Set the end here anyway?`,
                            )
                        ) {
                            return;
                        }
                        finish(position!);
                    }}
                >
                    Set end here
                </Button>
                <Button
                    className="h-12"
                    variant="outline"
                    onClick={() => {
                        if (window.confirm("Cancel this thermometer?")) {
                            thermometerRun.set(null);
                        }
                    }}
                >
                    Cancel
                </Button>
            </div>
            {noSignal && !position && (
                <Button
                    variant="link"
                    className="h-auto p-0"
                    onClick={() => {
                        const map = leafletMapContext.get();
                        if (!map) return;
                        const center = map.getCenter();
                        finish({ lat: center.lat, lng: center.lng });
                    }}
                >
                    Set end at the map center instead
                </Button>
            )}
        </div>
    );
};
