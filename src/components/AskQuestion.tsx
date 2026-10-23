import { useStore } from "@nanostores/react";
import * as turf from "@turf/turf";
import { CameraIcon, ChevronLeftIcon } from "lucide-react";
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
    addPhotoQuestion,
    addQuestion,
    displayHidingZones,
    isLoading,
    leafletMapContext,
    photoQuestions,
    questions,
    thermometerRun,
} from "@/lib/context";
import {
    getPrecisePosition,
    type LatLng,
    questionLocation,
    showQuestion,
    watchFreshPosition,
} from "@/lib/gps";
import { formatNumber, type MessageKey, t, tr, useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { isPending, questionTitle } from "@/maps/answers";
import { clockTime } from "@/maps/deadline";
import {
    cardQuestionData,
    type DeckCard,
    deckGroups,
    MATCHING_DECK,
    MEASURING_DECK,
    PHOTO_DECK,
    type PhotoCard,
    RADAR_DISTANCES,
    THERMOMETER_DISTANCES,
} from "@/maps/deck";
import { photoTitle } from "@/maps/hiderLog";
import {
    type Asked,
    askedCards,
    deckCardId,
    photoCardId,
    radarCardId,
    thermometerCardId,
} from "@/maps/repeats";

import { SendLinkButton } from "./cards/answer";
import { QUESTION_ICONS } from "./questionIcons";

/** The kinds keep their names from the game in both languages. */
const KINDS = {
    matching: {
        label: "Matching",
        question: "kind.matching.question",
        icon: QUESTION_ICONS.matching,
    },
    measuring: {
        label: "Measuring",
        question: "kind.measuring.question",
        icon: QUESTION_ICONS.measuring,
    },
    radar: {
        label: "Radar",
        question: "kind.radar.question",
        icon: QUESTION_ICONS.radius,
    },
    thermometer: {
        label: "Thermometer",
        question: "kind.thermometer.question",
        icon: QUESTION_ICONS.thermometer,
    },
    photo: {
        // Translated, unlike the others
        label: "photo.kind",
        question: "photo.question",
        icon: CameraIcon,
    },
} satisfies Record<
    string,
    { label: string; question: MessageKey; icon: unknown }
>;

type Kind = keyof typeof KINDS;

const kindLabel = (kind: Kind) =>
    kind === "photo" ? t("photo.kind") : KINDS[kind].label;

const formatDistance = (kilometers: number) =>
    kilometers < 1
        ? `${Math.round(kilometers * 1000)} m`
        : `${formatNumber(kilometers, 2, 2)} km`;

/** Questions and photos still waiting for the hider's answer. */
const usePending = () => {
    const $questions = useStore(questions);
    const $photoQuestions = useStore(photoQuestions);
    return [
        ...$questions.filter(isPending).map((question) => ({
            key: question.key,
            title: questionTitle(question),
        })),
        ...$photoQuestions
            .filter((photo) => photo.status === "pending")
            .map((photo) => ({
                key: photo.key,
                title: photoTitle(photo.photo),
            })),
    ];
};

/** "Already asked at 14:32: again costs double", under a card. */
const askedNote = (asked: Asked | undefined) => {
    if (!asked) return undefined;
    const time = asked.last ? clockTime(asked.last) : "?";
    return asked.count === 1
        ? t("ask.asked", { time })
        : t("ask.askedMany", {
              count: asked.count,
              time,
              times: asked.count + 1,
          });
};

/** "asked 14:32 · ×2", on the small radar and thermometer buttons. */
const AskedShort = ({ asked }: { asked: Asked | undefined }) =>
    asked ? (
        <span className="text-xs font-normal text-sky-400">
            {t("ask.askedShort", {
                time: asked.last ? clockTime(asked.last) : "?",
                times: asked.count + 1,
            })}
        </span>
    ) : null;

/** Reminder of questions without an answer; opens the first one. */
export const WaitingForAnswer = () => {
    useLanguage();
    const pending = usePending();

    if (pending.length === 0) return null;

    return (
        <button
            className="max-w-[92vw] truncate rounded-full bg-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-lg hover:bg-orange-600"
            onClick={() => showQuestion(pending[0].key)}
        >
            {pending.length === 1
                ? t("waiting.one", { title: pending[0].title })
                : t("waiting.many", { count: pending.length })}
        </button>
    );
};

/** The big "Ask a question" button and the question cards it opens. */
export const AskQuestionDrawer = ({ className }: { className?: string }) => {
    useLanguage();
    const $isLoading = useStore(isLoading);
    const $thermometerRun = useStore(thermometerRun);
    const $displayHidingZones = useStore(displayHidingZones);
    const $questions = useStore(questions);
    const $photoQuestions = useStore(photoQuestions);
    const pending = usePending();
    const asked = askedCards($questions, $photoQuestions);
    const [open, setOpen] = useState(false);
    /** Asking while an answer is missing, after the seekers confirmed it. */
    const [askAnyway, setAskAnyway] = useState(false);
    const [kind, setKind] = useState<Kind | null>(null);
    const [busy, setBusy] = useState(false);
    const [otherKilometers, setOtherKilometers] = useState("");

    const ask = async (data: (at: LatLng & { accuracy?: number }) => any) => {
        // The map shows how precise the location is while the app waits for it
        setOpen(false);
        setBusy(true);
        try {
            const at = await questionLocation();
            if (!at) return;
            const key = Math.random();
            addQuestion({ key, ...data(at) });
            showQuestion(key);
        } finally {
            setBusy(false);
        }
    };

    const askCard = (id: "matching" | "measuring", card: DeckCard) =>
        ask((at) => ({
            id,
            data: {
                lat: at.lat,
                lng: at.lng,
                accuracy: at.accuracy,
                ...cardQuestionData(card),
            },
        }));

    const askRadar = (radius: number, unit: "meters" | "kilometers") =>
        ask((at) => ({
            id: "radius",
            data: {
                lat: at.lat,
                lng: at.lng,
                accuracy: at.accuracy,
                radius,
                unit,
            },
        }));

    /** Photo questions don't need a location: only the log and the clock. */
    const askPhoto = (card: PhotoCard) => {
        setOpen(false);
        showQuestion(addPhotoQuestion(card.id).key);
    };

    const startThermometer = async (kilometers: number) => {
        setOpen(false);
        setBusy(true);
        const at = await getPrecisePosition();
        setBusy(false);

        if (at) {
            thermometerRun.set({
                latA: at.lat,
                lngA: at.lng,
                accuracyA: at.accuracy,
                kilometers,
            });
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
                distance: kilometers,
            },
        });
        toast.warning(t("ask.thermometer.noLocation"), { autoClose: 6000 });
        showQuestion(key);
    };

    const cardButton = (id: "matching" | "measuring", card: DeckCard) => {
        const needsZones = card.needsHidingZones && !$displayHidingZones;
        const repeat = askedNote(asked.get(deckCardId(id, card)));
        const note = card.noAnswer
            ? t("ask.noAnswer", { reason: tr(card.noAnswer) })
            : needsZones
              ? t("ask.needsZones")
              : card.hint && tr(card.hint);

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
                <div className="font-semibold">{tr(card.label)}</div>
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
                {repeat && (
                    <div className="text-xs font-medium text-sky-400">
                        {repeat}
                    </div>
                )}
            </button>
        );
    };

    let content;
    switch (kind) {
        case null:
            // One question at a time, by the rules: ask before a second one
            if (pending.length > 0 && !askAnyway) {
                content = (
                    <div className="flex flex-col gap-3">
                        <div className="rounded-lg border-2 border-orange-500 bg-orange-500/10 p-3">
                            <div className="font-semibold">
                                {pending.length === 1
                                    ? t("ask.pending.one", {
                                          title: pending[0].title,
                                      })
                                    : t("ask.pending.many", {
                                          count: pending.length,
                                      })}
                            </div>
                            <p className="text-sm text-muted-foreground">
                                {t("ask.pending.rule")}
                            </p>
                        </div>
                        <Button
                            className="h-12 bg-orange-500 text-base font-semibold text-white hover:bg-orange-600"
                            onClick={() => {
                                setOpen(false);
                                showQuestion(pending[0].key);
                            }}
                        >
                            {t("ask.pending.enter")}
                        </Button>
                        <Button
                            variant="outline"
                            className="h-12 text-base"
                            onClick={() => setAskAnyway(true)}
                        >
                            {t("ask.pending.anyway")}
                        </Button>
                    </div>
                );
                break;
            }
            content = (
                <div className="grid grid-cols-2 gap-3">
                    {(Object.keys(KINDS) as Kind[]).map((k) => {
                        const Icon = KINDS[k].icon;
                        return (
                            <button
                                key={k}
                                className={cn(
                                    "flex min-h-28 flex-col justify-center gap-1 rounded-lg border p-3 text-left transition-colors hover:bg-accent active:bg-accent",
                                    // The fifth kind fills the last row
                                    k === "photo" && "col-span-2 min-h-20",
                                )}
                                onClick={() => setKind(k)}
                            >
                                <Icon className="h-6 w-6 shrink-0" />
                                <span className="text-xl font-semibold font-poppins">
                                    {kindLabel(k)}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    {t(KINDS[k].question)}
                                </span>
                            </button>
                        );
                    })}
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
                        <div key={group.en} className="flex flex-col gap-2">
                            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                                {tr(group)}
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
                                className="h-14 flex-col gap-0 text-lg"
                                disabled={busy}
                                onClick={() =>
                                    askRadar(distance.radius, distance.unit)
                                }
                            >
                                {distance.label}
                                <AskedShort
                                    asked={asked.get(radarCardId(distance))}
                                />
                            </Button>
                        ))}
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm">{t("ask.radar.choose")}</span>
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
                            {t("ask.radar.ask")}
                        </Button>
                    </div>
                </div>
            );
            break;
        case "photo":
            content = (
                <div className="flex flex-col gap-2">
                    <p className="text-sm text-muted-foreground">
                        {t("photo.help")}
                    </p>
                    {PHOTO_DECK.map((card) => (
                        <button
                            key={card.id}
                            className="w-full rounded-md border px-3 py-2 text-left transition-colors hover:bg-accent active:bg-accent disabled:opacity-60"
                            disabled={busy}
                            onClick={() => askPhoto(card)}
                        >
                            <div className="font-semibold">
                                {tr(card.label)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                                {tr(card.hint)}
                            </div>
                            {asked.has(photoCardId(card.id)) && (
                                <div className="text-xs font-medium text-sky-400">
                                    {askedNote(asked.get(photoCardId(card.id)))}
                                </div>
                            )}
                        </button>
                    ))}
                </div>
            );
            break;
        case "thermometer":
            content = (
                <div className="flex flex-col gap-3">
                    <p className="text-sm text-muted-foreground">
                        {t("ask.thermometer.help")}
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                        {THERMOMETER_DISTANCES.map((distance) => (
                            <Button
                                key={distance.label}
                                variant="outline"
                                className="h-16 flex-col gap-0 text-lg"
                                disabled={busy}
                                onClick={() =>
                                    startThermometer(distance.kilometers)
                                }
                            >
                                {t("ask.thermometer.start", {
                                    distance: distance.label,
                                })}
                                <AskedShort
                                    asked={asked.get(
                                        thermometerCardId(distance.kilometers),
                                    )}
                                />
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
                if (value) {
                    setKind(null);
                    setAskAnyway(false);
                }
            }}
        >
            <DrawerTrigger asChild>
                {/* One question at a time: not while a thermometer runs */}
                <Button
                    className={cn(
                        "h-14 rounded-xl bg-blue-600 px-4 text-base font-semibold text-white shadow-lg hover:bg-blue-700",
                        className,
                    )}
                    disabled={$isLoading || !!$thermometerRun || busy}
                >
                    <TbMessage2Question className="!size-6" />
                    {t("ask.button")}
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
                                    title={t("common.back")}
                                >
                                    <ChevronLeftIcon />
                                </Button>
                            )}
                            <DrawerTitle className="text-2xl font-semibold font-poppins">
                                {kind ? kindLabel(kind) : t("ask.button")}
                            </DrawerTitle>
                        </div>
                        <DrawerDescription>
                            {kind
                                ? t(KINDS[kind].question)
                                : t("ask.description")}
                        </DrawerDescription>
                    </DrawerHeader>
                    <div className="overflow-y-auto px-4 pb-6">{content}</div>
                </div>
            </DrawerContent>
        </Drawer>
    );
};

/** The thermometer on its way: distance so far and "Set end here". */
export const ThermometerTracker = ({
    run,
}: {
    run: {
        latA: number;
        lngA: number;
        accuracyA?: number;
        kilometers: number;
        toldAt?: number;
    };
}) => {
    useLanguage();
    const [position, setPosition] = useState<LatLng | null>(null);
    const [noSignal, setNoSignal] = useState(false);
    const [locating, setLocating] = useState(false);

    useEffect(() => {
        if (typeof navigator === "undefined" || !navigator.geolocation) {
            setNoSignal(true);
            return;
        }
        // Starts over after the phone was locked on the way
        const watch = watchFreshPosition(
            (p) => {
                setPosition({
                    lat: p.coords.latitude,
                    lng: p.coords.longitude,
                });
                setNoSignal(false);
            },
            () => setNoSignal(true),
            5_000,
        );
        return watch.stop;
    }, []);

    const target =
        run.kilometers < 1
            ? formatDistance(run.kilometers)
            : `${formatNumber(run.kilometers, 2)} km`;
    const traveledTo = (end: LatLng) =>
        turf.distance([run.lngA, run.latA], [end.lng, end.lat], {
            units: "kilometers",
        });
    const traveled = position ? traveledTo(position) : 0;
    const reached = traveled >= run.kilometers;

    const finish = (end: LatLng & { accuracy?: number }) => {
        const key = Math.random();
        addQuestion({
            id: "thermometer",
            key,
            data: {
                latA: run.latA,
                lngA: run.lngA,
                accuracyA: run.accuracyA,
                latB: end.lat,
                lngB: end.lng,
                accuracyB: end.accuracy,
                distance: run.kilometers,
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
                    {t("thermometer.crowFlies")}
                </span>
            </div>
            <div className="text-2xl font-semibold">
                {position
                    ? t("thermometer.progress", {
                          traveled: formatDistance(traveled),
                          target,
                      })
                    : noSignal
                      ? t("thermometer.noSignal")
                      : t("thermometer.waiting")}
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
            {/* By the rules, the seekers tell the hider when they start */}
            <SendLinkButton
                label={t("thermometer.tellHider")}
                makeLink={async () => {
                    thermometerRun.set({ ...run, toldAt: Date.now() });
                    return `https://maps.google.com/?q=${run.latA.toFixed(6)},${run.lngA.toFixed(6)}`;
                }}
                message={(link) =>
                    t("thermometer.tellMessage", {
                        distance: target,
                        time: clockTime(Date.now()),
                        link,
                    })
                }
            />
            {run.toldAt !== undefined && (
                <div className="text-xs text-muted-foreground">
                    {t("thermometer.told", { time: clockTime(run.toldAt) })}
                </div>
            )}
            <div className="flex gap-2">
                <Button
                    className={cn(
                        "h-12 flex-1 text-base",
                        reached && "bg-green-600 text-white hover:bg-green-700",
                    )}
                    variant={reached ? "default" : "outline"}
                    disabled={!position || locating}
                    onClick={async () => {
                        // The end is where the question is asked: a precise position
                        setLocating(true);
                        const end = (await getPrecisePosition()) ?? position!;
                        setLocating(false);
                        const traveledToEnd = traveledTo(end);
                        if (
                            traveledToEnd < run.kilometers &&
                            !window.confirm(
                                t("thermometer.tooShort", {
                                    traveled: formatDistance(traveledToEnd),
                                    target,
                                }),
                            )
                        ) {
                            return;
                        }
                        finish(end);
                    }}
                >
                    {t("thermometer.setEnd")}
                </Button>
                <Button
                    className="h-12"
                    variant="outline"
                    onClick={() => {
                        if (window.confirm(t("thermometer.cancel"))) {
                            thermometerRun.set(null);
                        }
                    }}
                >
                    {t("common.cancel")}
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
                    {t("thermometer.endAtCenter")}
                </Button>
            )}
        </div>
    );
};
