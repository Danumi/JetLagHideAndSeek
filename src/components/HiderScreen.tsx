import { useStore } from "@nanostores/react";
import {
    LoaderCircleIcon,
    LocateFixedIcon,
    MapIcon,
    VenetianMaskIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";

import { Button } from "@/components/ui/button";
import {
    hiderInbox,
    type HiderInboxEntry,
    hiderMode,
    hiderScreenOpen,
    leafletMapContext,
    questions,
    VIENNA,
} from "@/lib/context";
import { getCurrentPosition } from "@/lib/gps";
import { loadingTasks, retryTrigger } from "@/lib/loading";
import { QUESTION_URL_PARAM, readQuestionLink } from "@/lib/questionLink";
import { cn } from "@/lib/utils";
import {
    answerOptions,
    askedAtText,
    isPending,
    questionTitle,
} from "@/maps/answers";
import { type HiderAnswer, workOutAnswer } from "@/maps/hider";
import type { Question } from "@/maps/schema";

/** Where the hider's location comes from. */
type Fix =
    | { state: "locating" }
    | { state: "failed" }
    | {
          state: "gps";
          latitude: number;
          longitude: number;
          accuracy: number;
          at: number;
      }
    /** The green hider marker on the map, placed by hand. */
    | { state: "marker" };

type Result =
    | { key: number; state: "working" }
    | { key: number; state: "done"; answer: HiderAnswer }
    | { key: number; state: "error"; message: string };

const answerLabel = (question: Question, answer: HiderAnswer) => {
    if (answer.value === "no-answer") return "No answer";
    if (question.id === "tentacles") {
        return answer.location
            ? String(answer.location.properties?.name ?? "Place")
            : "Not within";
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

/** Hider mode starts where the map is until GPS knows better. */
const startHiderMode = () => {
    if (hiderMode.get() !== false) return;
    const center = leafletMapContext.get()?.getCenter();
    hiderMode.set(
        center
            ? { latitude: center.lat, longitude: center.lng }
            : {
                  latitude: VIENNA.geometry.coordinates[0],
                  longitude: VIENNA.geometry.coordinates[1],
              },
    );
};

const removeUrlParam = (param: string) => {
    const url = new URL(window.location.href);
    url.searchParams.delete(param);
    window.history.replaceState({}, "", url);
};

/**
 * The hider's own screen: questions the seekers sent as links, with the
 * answer the app works out from the hider's GPS location.
 */
export const HiderScreen = () => {
    const $open = useStore(hiderScreenOpen);
    const $hiderMode = useStore(hiderMode);
    const $inbox = useStore(hiderInbox);
    const $retryTrigger = useStore(retryTrigger);
    const $loadingTasks = useStore(loadingTasks);
    const [fix, setFix] = useState<Fix>({ state: "locating" });
    const [selectedKey, setSelectedKey] = useState<number | null>(null);
    const [result, setResult] = useState<Result | null>(null);
    const [attempt, setAttempt] = useState(0);
    // A question link opened on a phone that has questions of its own
    const [confirming, setConfirming] = useState(false);

    const locate = async () => {
        setFix({ state: "locating" });
        const position = await getCurrentPosition();
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
                    toast.info(
                        "This is your own question. Send the link to the hider: their phone works out the answer.",
                        { autoClose: 8000 },
                    );
                    return;
                }

                hiderInbox.set([
                    ...hiderInbox
                        .get()
                        .filter((entry) => entry.question.key !== question.key),
                    { question, number, receivedAt: Date.now() },
                ]);
                setSelectedKey(null);

                if (
                    hiderMode.get() === false &&
                    questions.get().some(isPending)
                ) {
                    setConfirming(true);
                } else {
                    startHiderMode();
                }
                hiderScreenOpen.set(true);
            })
            .catch((error) => {
                removeUrlParam(QUESTION_URL_PARAM);
                console.log(error);
                toast.error(
                    "This question link is broken. Ask the seekers to send it again.",
                );
            });
    }, []);

    // Find the hider whenever the screen opens: they may have moved
    useEffect(() => {
        if ($open && hiderMode.get() !== false && !confirming) locate();
    }, [$open, $hiderMode === false, confirming]);

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
                hiderInbox.set(
                    hiderInbox.get().map((x) =>
                        x.question.key === key
                            ? {
                                  ...x,
                                  answer: answerLabel(x.question, answer),
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
    ]);

    if (!$open) return null;

    const close = () => {
        setConfirming(false);
        hiderScreenOpen.set(false);
    };

    const leave = () => {
        hiderMode.set(false);
        close();
    };

    const fromGps =
        fix.state === "gps" &&
        $hiderMode !== false &&
        fix.latitude === $hiderMode.latitude &&
        fix.longitude === $hiderMode.longitude;

    const current = result && entry && result.key === entry.question.key;
    const earlier = $inbox.filter((x) => x !== entry).reverse();

    let body;
    if (confirming) {
        const pending = questions.get().filter(isPending).length;
        body = (
            <div className="flex flex-col gap-4">
                <h2 className="text-2xl font-semibold font-poppins">
                    Are you the hider?
                </h2>
                <p>
                    The seekers sent you a question. This phone has{" "}
                    {pending === 1 ? "a question" : `${pending} questions`} of
                    its own waiting for an answer, so it looks like a
                    seeker&apos;s phone. In hider mode, the map answers those
                    questions from this phone&apos;s location.
                </p>
                <Button
                    className="h-14 bg-violet-600 text-lg font-semibold text-white hover:bg-violet-700"
                    onClick={() => {
                        setConfirming(false);
                        startHiderMode();
                    }}
                >
                    I&apos;m the hider
                </Button>
                <Button variant="outline" className="h-12" onClick={close}>
                    Cancel
                </Button>
            </div>
        );
    } else if ($hiderMode === false) {
        body = (
            <div className="flex flex-col gap-4">
                <h2 className="text-2xl font-semibold font-poppins">
                    Use this phone as the hider&apos;s phone
                </h2>
                <p>
                    The seekers send each question as a link. Open it on this
                    phone: the app takes your GPS location and shows you the
                    answer. Then tell the seekers the answer in your chat.
                </p>
                <Button
                    className="h-14 bg-violet-600 text-lg font-semibold text-white hover:bg-violet-700"
                    onClick={startHiderMode}
                >
                    Start hider mode
                </Button>
                <Button variant="outline" className="h-12" onClick={close}>
                    Cancel
                </Button>
            </div>
        );
    } else {
        body = (
            <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3 rounded-lg border p-3">
                    <LocateFixedIcon className="size-5 shrink-0" />
                    <div className="min-w-0 flex-1 text-sm">
                        {fix.state === "locating" && "Getting your location..."}
                        {fix.state === "failed" && (
                            <span className="text-orange-400">
                                Couldn&apos;t get your location. Allow location
                                access for this site, or use the green marker on
                                the map.
                            </span>
                        )}
                        {fix.state === "gps" &&
                            (fromGps
                                ? `Your location: GPS, ${clockTime(fix.at)}, ±${Math.round(
                                      fix.accuracy,
                                  )} m`
                                : "Your location: the green marker on the map")}
                        {fix.state === "marker" &&
                            "Your location: the green marker on the map"}
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={fix.state === "locating"}
                        onClick={locate}
                    >
                        Update
                    </Button>
                </div>
                {fix.state === "failed" && (
                    <Button
                        variant="outline"
                        onClick={() => setFix({ state: "marker" })}
                    >
                        Use the green marker
                    </Button>
                )}

                {entry ? (
                    <div className="flex flex-col gap-3 rounded-lg border-2 border-violet-500 p-4">
                        <div>
                            <div className="text-sm text-muted-foreground">
                                Question from the seekers
                                {askedAtText(entry.question) &&
                                    ` · asked ${askedAtText(entry.question)}`}
                            </div>
                            <div className="text-xl font-semibold font-poppins">
                                {entryTitle(entry)}
                            </div>
                        </div>
                        {!location && (
                            <p className="text-sm text-muted-foreground">
                                Your answer appears once your location is known.
                            </p>
                        )}
                        {location && current && result.state === "working" && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <LoaderCircleIcon className="size-4 animate-spin" />
                                {$loadingTasks[0]?.label ??
                                    "Working out your answer..."}
                            </div>
                        )}
                        {location && current && result.state === "error" && (
                            <div className="flex flex-col gap-2">
                                <p className="text-sm text-orange-400">
                                    Couldn&apos;t work out the answer: map data
                                    didn&apos;t load.
                                </p>
                                <Button
                                    variant="outline"
                                    onClick={() => setAttempt(attempt + 1)}
                                >
                                    Try again
                                </Button>
                            </div>
                        )}
                        {location && current && result.state === "done" && (
                            <div className="flex flex-col gap-2">
                                <div className="text-sm text-muted-foreground">
                                    Your answer
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
                                    Tell the seekers this answer in your chat.
                                    Only the answer: the reason above is for
                                    you.
                                </p>
                            </div>
                        )}
                    </div>
                ) : (
                    <p className="text-muted-foreground">
                        No question yet. When the seekers send you a question
                        link, open it on this phone and your answer appears
                        here.
                    </p>
                )}

                {earlier.length > 0 && (
                    <div className="flex flex-col gap-1">
                        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                            Earlier questions
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
                                    {x.answer && (
                                        <span className="text-violet-300">
                                            {" "}
                                            · {x.answer}
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

                <Button
                    variant="outline"
                    className="mt-4 text-red-400"
                    onClick={leave}
                >
                    Leave hider mode
                </Button>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[1036] flex flex-col bg-background text-foreground">
            <div className="flex items-center gap-3 bg-violet-700 px-4 py-3 text-white shadow-md">
                <VenetianMaskIcon className="size-7 shrink-0" />
                <h1 className="flex-1 text-2xl font-semibold font-poppins">
                    Hider mode
                </h1>
                <Button
                    variant="secondary"
                    className={cn("gap-2", $hiderMode === false && "hidden")}
                    onClick={close}
                >
                    <MapIcon />
                    Map
                </Button>
            </div>
            <div className="flex-1 overflow-y-auto">
                <div className="mx-auto max-w-lg p-4">{body}</div>
            </div>
        </div>
    );
};
