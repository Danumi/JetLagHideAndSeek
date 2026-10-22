import { useStore } from "@nanostores/react";
import {
    LoaderCircleIcon,
    LocateFixedIcon,
    MapIcon,
    MapPinIcon,
    SettingsIcon,
    TriangleAlertIcon,
    VenetianMaskIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";

import { Button } from "@/components/ui/button";
import {
    hiderInbox,
    type HiderInboxEntry,
    hiderMode,
    hiderScreenOpen,
    hiderZoneId,
    questions,
    settingsOpen,
} from "@/lib/context";
import { findPrecisePosition } from "@/lib/gps";
import { t, useLanguage } from "@/lib/i18n";
import { loadingTasks, retryTrigger } from "@/lib/loading";
import { QUESTION_URL_PARAM, readQuestionLink } from "@/lib/questionLink";
import { questionLinkRole, setRole } from "@/lib/role";
import { cn } from "@/lib/utils";
import { answerOptions, askedAtText, questionTitle } from "@/maps/answers";
import { type HiderAnswer, workOutAnswer } from "@/maps/hider";
import { hiderZoneCheck, zoneCheckText } from "@/maps/hidingZoneCheck";
import type { Question } from "@/maps/schema";

import { showActionToast } from "./UndoToast";

/** Where the hider's location comes from. */
type Fix =
    /** `accuracy`: of the most precise position so far, in meters. */
    | { state: "locating"; accuracy?: number }
    | { state: "failed" }
    | {
          state: "gps";
          latitude: number;
          longitude: number;
          accuracy: number;
          at: number;
      }
    /** The violet H marker on the map, placed by hand. */
    | { state: "marker" };

type Result =
    | { key: number; state: "working" }
    | { key: number; state: "done"; answer: HiderAnswer }
    | { key: number; state: "error"; message: string };

const answerLabel = (
    question: Question,
    answer: Pick<HiderAnswer, "value" | "location">,
) => {
    if (answer.value === "no-answer") return t("answer.none");
    if (question.id === "tentacles") {
        return answer.location
            ? String(answer.location.properties?.name ?? t("answer.place"))
            : t("answer.notWithin");
    }
    return (
        answerOptions(question).find((option) => option.value === answer.value)
            ?.label ?? answer.value
    );
};

const entryTitle = (entry: HiderInboxEntry) =>
    `${entry.number ? `${entry.number} · ` : ""}${questionTitle(entry.question)}`;

const clockTime = (time: number) =>
    new Date(time).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
    });

const removeUrlParam = (param: string) => {
    const url = new URL(window.location.href);
    url.searchParams.delete(param);
    window.history.replaceState({}, "", url);
};

/** Worse than this, the zone check may be wrong (e.g. underground). */
const POOR_GPS_METERS = 50;

/**
 * Whether the hider is in their hiding zone, live from the blue dot. Until
 * they chose one: the zone they are in, to choose it.
 */
const ZoneCheckCard = () => {
    const $zoneCheck = useStore(hiderZoneCheck);
    if (!$zoneCheck) return null;

    const { title, detail } = zoneCheckText($zoneCheck);
    const { chosen, inside } = $zoneCheck;
    const showMap = () => {
        hiderScreenOpen.set(false);
        toast.info(t("hider.chooseHint"), {
            autoClose: 4000,
            toastId: "choose-zone-hint",
        });
    };

    return (
        <div
            className={cn(
                "flex flex-col gap-3 rounded-lg border-2 p-3",
                !chosen
                    ? "border-violet-600 bg-violet-600/10"
                    : inside
                      ? "border-green-600 bg-green-600/10"
                      : "border-orange-500 bg-orange-500/10",
            )}
        >
            <div className="flex items-center gap-3">
                {!chosen ? (
                    <MapPinIcon className="size-6 shrink-0 text-violet-500" />
                ) : inside ? (
                    <MapPinIcon className="size-6 shrink-0 text-green-500" />
                ) : (
                    <TriangleAlertIcon className="size-6 shrink-0 text-orange-500" />
                )}
                <div className="min-w-0 flex-1">
                    <div className="font-semibold">{title}</div>
                    <div className="text-sm text-muted-foreground">
                        {detail}
                    </div>
                    {($zoneCheck.accuracy ?? 0) > POOR_GPS_METERS && (
                        <div className="text-xs text-orange-400">
                            {t("hider.poorGps", {
                                meters: Math.round($zoneCheck.accuracy ?? 0),
                            })}
                        </div>
                    )}
                </div>
                {chosen && (
                    <Button variant="outline" size="sm" onClick={showMap}>
                        {t("hider.change")}
                    </Button>
                )}
            </div>
            {!chosen && (
                <div className="flex flex-col gap-2">
                    {inside && (
                        <Button
                            className="h-11 bg-violet-700 font-semibold text-white hover:bg-violet-800"
                            onClick={() => hiderZoneId.set($zoneCheck.id)}
                        >
                            {t("hider.choose", {
                                station: $zoneCheck.station,
                            })}
                        </Button>
                    )}
                    <Button variant="outline" onClick={showMap}>
                        {inside
                            ? t("hider.chooseAnother")
                            : t("hider.chooseOnMap")}
                    </Button>
                </div>
            )}
        </div>
    );
};

/** A question link opened on this phone: the hider's phone answers it. */
const receiveQuestionLink = (entry: HiderInboxEntry) => {
    hiderInbox.set([
        ...hiderInbox
            .get()
            .filter((x) => x.question.key !== entry.question.key),
        entry,
    ]);

    const role = questionLinkRole();
    if (role === "hider") {
        hiderScreenOpen.set(true);
        return;
    }

    if (role === "seeker") {
        showActionToast(
            t("hider.forHider"),
            t("role.hiding"),
            () => setRole("hider"),
            10000,
        );
        return;
    }

    setRole("hider");
    showActionToast(
        t("hider.nowHider"),
        t("role.seeking"),
        () => setRole("seeker"),
        10000,
    );
};

/**
 * The hider's main screen: whether they are in a hiding zone, and the
 * questions the seekers sent as links, with the answer the app works out
 * from the hider's GPS location.
 */
export const HiderScreen = () => {
    const $language = useLanguage();
    const $open = useStore(hiderScreenOpen);
    const $hiderMode = useStore(hiderMode);
    const $inbox = useStore(hiderInbox);
    const $retryTrigger = useStore(retryTrigger);
    const $loadingTasks = useStore(loadingTasks);
    const [fix, setFix] = useState<Fix>({ state: "locating" });
    const [selectedKey, setSelectedKey] = useState<number | null>(null);
    const [result, setResult] = useState<Result | null>(null);
    const [attempt, setAttempt] = useState(0);

    const stopWaiting = useRef(() => {});

    /** Waits a few seconds for a precise position, like new questions. */
    const locate = async () => {
        setFix({ state: "locating" });
        const search = findPrecisePosition((best) =>
            setFix({ state: "locating", accuracy: best?.accuracy }),
        );
        stopWaiting.current = search.stopWaiting;
        const position = await search.position;
        if (!position) {
            setFix({ state: "failed" });
            return;
        }
        hiderMode.set({ latitude: position.lat, longitude: position.lng });
        setFix({
            state: "gps",
            latitude: position.lat,
            longitude: position.lng,
            accuracy: position.accuracy,
            at: Date.now(),
        });
    };

    // A phone in hider mode opens on this screen; question links open it too
    useEffect(() => {
        if (hiderMode.get() !== false) hiderScreenOpen.set(true);

        const value = new URL(window.location.href).searchParams.get(
            QUESTION_URL_PARAM,
        );
        if (value === null) return;

        readQuestionLink(value)
            .then(({ question, number }) => {
                // The link is kept until it is in the inbox, in case the page reloads
                removeUrlParam(QUESTION_URL_PARAM);

                if (questions.get().some((q) => q.key === question.key)) {
                    toast.info(t("hider.ownQuestion"), { autoClose: 8000 });
                    return;
                }

                setSelectedKey(null);
                receiveQuestionLink({
                    question,
                    number,
                    receivedAt: Date.now(),
                });
            })
            .catch((error) => {
                removeUrlParam(QUESTION_URL_PARAM);
                console.log(error);
                toast.error(t("hider.brokenLink"));
            });
    }, []);

    // Find the hider whenever the screen opens: they may have moved
    useEffect(() => {
        if ($open && hiderMode.get() !== false) locate();
    }, [$open, $hiderMode === false]);

    const entry =
        $inbox.find((x) => x.question.key === selectedKey) ??
        $inbox[$inbox.length - 1];

    const location =
        $hiderMode !== false && (fix.state === "gps" || fix.state === "marker")
            ? $hiderMode
            : null;

    useEffect(() => {
        if (!$open || !entry || !location) return;

        const key = entry.question.key;
        let cancelled = false;
        setResult({ key, state: "working" });
        workOutAnswer(entry.question, location)
            .then((answer) => {
                if (cancelled) return;
                setResult({ key, state: "done", answer });
                // The answer, not its text: the list shows it in the phone's language
                hiderInbox.set(
                    hiderInbox.get().map((x) =>
                        x.question.key === key
                            ? {
                                  ...x,
                                  answer: undefined,
                                  workedOut: {
                                      value: answer.value,
                                      location: answer.location,
                                  },
                              }
                            : x,
                    ),
                );
            })
            .catch((error) => {
                if (cancelled) return;
                console.log(error);
                setResult({
                    key,
                    state: "error",
                    message: String(error?.message ?? error),
                });
            });

        return () => {
            cancelled = true;
        };
    }, [
        $open,
        entry?.question.key,
        location?.latitude,
        location?.longitude,
        attempt,
        $retryTrigger,
        // The reason is written in the phone's language
        $language,
    ]);

    // Only the hider's phone has this screen
    if (!$open || $hiderMode === false) return null;

    const close = () => hiderScreenOpen.set(false);

    const fromGps =
        fix.state === "gps" &&
        fix.latitude === $hiderMode.latitude &&
        fix.longitude === $hiderMode.longitude;

    const current = result && entry && result.key === entry.question.key;
    const earlier = $inbox.filter((x) => x !== entry).reverse();

    const body = (
        <div className="flex flex-col gap-4">
            <ZoneCheckCard />
            <div className="flex items-center gap-3 rounded-lg border p-3">
                <LocateFixedIcon className="size-5 shrink-0" />
                <div className="min-w-0 flex-1 text-sm">
                    {fix.state === "locating" &&
                        (fix.accuracy === undefined
                            ? t("locating.waiting")
                            : t("locating.accuracy", {
                                  meters: Math.round(fix.accuracy),
                              }))}
                    {fix.state === "failed" && (
                        <span className="text-orange-400">
                            {t("hider.locationFailed")}
                        </span>
                    )}
                    {fix.state === "gps" &&
                        (fromGps
                            ? t("hider.locationGps", {
                                  time: clockTime(fix.at),
                                  meters: Math.round(fix.accuracy),
                              })
                            : t("hider.locationMarker"))}
                    {fix.state === "marker" && t("hider.locationMarker")}
                </div>
                {fix.state === "locating" && fix.accuracy !== undefined ? (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => stopWaiting.current()}
                    >
                        {t("locating.useAnyway")}
                    </Button>
                ) : (
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={fix.state === "locating"}
                        onClick={locate}
                    >
                        {t("hider.update")}
                    </Button>
                )}
            </div>
            {fix.state === "failed" && (
                <Button
                    variant="outline"
                    onClick={() => setFix({ state: "marker" })}
                >
                    {t("hider.useMarker")}
                </Button>
            )}

            {entry ? (
                <div className="flex flex-col gap-3 rounded-lg border-2 border-violet-500 p-4">
                    <div>
                        <div className="text-sm text-muted-foreground">
                            {askedAtText(entry.question)
                                ? t("hider.questionFromAt", {
                                      time: askedAtText(entry.question)!,
                                  })
                                : t("hider.questionFrom")}
                        </div>
                        <div className="text-xl font-semibold font-poppins">
                            {entryTitle(entry)}
                        </div>
                    </div>
                    {!location && (
                        <p className="text-sm text-muted-foreground">
                            {t("hider.waitingForLocation")}
                        </p>
                    )}
                    {location && current && result.state === "working" && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <LoaderCircleIcon className="size-4 animate-spin" />
                            {$loadingTasks[0]?.label ?? t("hider.working")}
                        </div>
                    )}
                    {location && current && result.state === "error" && (
                        <div className="flex flex-col gap-2">
                            <p className="text-sm text-orange-400">
                                {t("hider.failed")}
                            </p>
                            <Button
                                variant="outline"
                                onClick={() => setAttempt(attempt + 1)}
                            >
                                {t("hider.tryAgain")}
                            </Button>
                        </div>
                    )}
                    {location && current && result.state === "done" && (
                        <div className="flex flex-col gap-2">
                            <div className="text-sm text-muted-foreground">
                                {t("hider.yourAnswer")}
                            </div>
                            <div className="text-4xl font-bold font-poppins text-violet-300">
                                {answerLabel(entry.question, result.answer)}
                            </div>
                            {result.answer.reason && (
                                <p className="text-sm">
                                    {result.answer.reason}
                                </p>
                            )}
                            <p className="text-sm text-muted-foreground">
                                {t("hider.tellSeekers")}
                            </p>
                        </div>
                    )}
                </div>
            ) : (
                <p className="text-muted-foreground">{t("hider.noQuestion")}</p>
            )}

            {earlier.length > 0 && (
                <div className="flex flex-col gap-1">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                        {t("hider.earlier")}
                    </h3>
                    {earlier.map((x) => (
                        <button
                            key={x.question.key}
                            className="flex items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-accent"
                            onClick={() => setSelectedKey(x.question.key)}
                        >
                            <span className="min-w-0 flex-1">
                                <span className="font-semibold">
                                    {entryTitle(x)}
                                </span>
                                {(x.workedOut || x.answer) && (
                                    <span className="text-violet-300">
                                        {" "}
                                        ·{" "}
                                        {x.workedOut
                                            ? answerLabel(
                                                  x.question,
                                                  x.workedOut,
                                              )
                                            : x.answer}
                                    </span>
                                )}
                                <span className="text-muted-foreground">
                                    {" "}
                                    · {clockTime(x.receivedAt)}
                                </span>
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );

    return (
        <div className="fixed inset-0 z-[1036] flex flex-col bg-background text-foreground">
            <div className="flex items-center gap-3 bg-violet-700 px-4 py-3 text-white shadow-md">
                <VenetianMaskIcon className="size-7 shrink-0" />
                <h1 className="flex-1 text-2xl font-semibold font-poppins">
                    {t("bar.hiderMode")}
                </h1>
                <Button variant="secondary" className="gap-2" onClick={close}>
                    <MapIcon />
                    {t("hider.map")}
                </Button>
                <Button
                    variant="secondary"
                    size="icon"
                    title={t("settings.title")}
                    onClick={() => settingsOpen.set(true)}
                >
                    <SettingsIcon />
                </Button>
            </div>
            <div className="flex-1 overflow-y-auto">
                <div className="mx-auto max-w-lg p-4">{body}</div>
            </div>
        </div>
    );
};
