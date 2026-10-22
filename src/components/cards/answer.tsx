import { useStore } from "@nanostores/react";
import * as turf from "@turf/turf";
import { SendIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "react-toastify";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
    allTrainStations,
    hiderMode,
    questionModified,
    questions,
} from "@/lib/context";
import { questionLink } from "@/lib/questionLink";
import { cn, shareMessage } from "@/lib/utils";
import {
    answerOptions,
    answerText,
    askedAtText,
    currentAnswer,
    questionTitle,
    setAnswer,
    setNoAnswer,
} from "@/maps/answers";
import type { StationPlace } from "@/maps/api";
import { extractStationName } from "@/maps/geo-utils";
import type { Question, Questions } from "@/maps/schema";

/** "3 · Radar 2 km": the question's number in the list and its name. */
export const numberedTitle = (questions: Questions, questionKey: number) => {
    const index = questions.findIndex((q) => q.key === questionKey);
    return index === -1
        ? ""
        : `${index + 1} · ${questionTitle(questions[index])}`;
};

/**
 * Big buttons for the hider's answer. Tapping one locks the question, and
 * only then does it change the map.
 */
export const AnswerButtons = ({ question }: { question: Question }) => {
    const $hiderMode = useStore(hiderMode);
    const pending = question.data.status === "pending";
    const options = answerOptions(question);
    const current =
        question.data.status === "pending"
            ? undefined
            : question.data.status === "no-answer"
              ? "no-answer"
              : (currentAnswer(question) ?? "answered");
    // In hider mode the app works out the answer itself
    const disabled = $hiderMode !== false;

    const answer = (value: string) => {
        setAnswer(question, value);
        questionModified();
    };

    return (
        <div className="flex flex-col gap-2 p-2">
            {pending && !disabled && <SendToHider question={question} />}
            <span
                className={cn(
                    "text-sm font-semibold",
                    pending ? "text-orange-400" : "text-muted-foreground",
                )}
            >
                {pending
                    ? "Waiting for the hider's answer"
                    : "Hider's answer (tap one to save)"}
            </span>
            {options.length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                    {options.map((option) => (
                        <Button
                            key={option.value}
                            variant={
                                current === option.value ? "default" : "outline"
                            }
                            className="h-14 text-lg font-semibold"
                            disabled={disabled}
                            onClick={() => answer(option.value)}
                        >
                            {option.label}
                        </Button>
                    ))}
                </div>
            ) : (
                <Button
                    variant={
                        current && current !== "no-answer"
                            ? "default"
                            : "outline"
                    }
                    className="h-14 text-lg font-semibold"
                    disabled={disabled}
                    onClick={() => answer("place")}
                >
                    Save answer
                </Button>
            )}
            <Button
                variant={current === "no-answer" ? "default" : "outline"}
                className="h-10"
                disabled={disabled}
                onClick={() => {
                    setNoAnswer(question);
                    questionModified();
                }}
            >
                No answer
            </Button>
        </div>
    );
};

/**
 * Shares the question as a link (WhatsApp and co.). The hider opens it and
 * their phone works out the answer from their location.
 */
const SendToHider = ({ question }: { question: Question }) => {
    const $questions = useStore(questions);
    const [busy, setBusy] = useState(false);

    const send = async () => {
        setBusy(true);
        try {
            const index = $questions.findIndex((q) => q.key === question.key);
            const number = index === -1 ? undefined : index + 1;
            const link = await questionLink(question, number);
            const result = await shareMessage(
                `Question${number ? ` ${number}` : ""} for the hider: ${questionTitle(
                    question,
                )}\nOpen this link to see your answer: ${link}`,
            );
            if (result === "copied") {
                toast.success(
                    "Link copied. Paste it into your chat with the hider.",
                );
            } else if (result === false) {
                toast.error(
                    `Couldn't share. Send the hider this link: ${link}`,
                    {
                        autoClose: false,
                    },
                );
            }
        } catch (error) {
            toast.error(`Couldn't make the link: ${error}`);
        } finally {
            setBusy(false);
        }
    };

    return (
        <Button
            className="h-12 gap-2 bg-violet-600 text-base font-semibold text-white hover:bg-violet-700"
            disabled={busy}
            onClick={send}
        >
            <SendIcon className="!size-5" />
            Send to hider
        </Button>
    );
};

/** Name of the station nearest to a point, if one is within 1 km. */
const nearestStationName = (
    lat: number,
    lng: number,
    stations: StationPlace[],
) => {
    if (stations.length === 0) return undefined;
    const nearest = turf.nearestPoint(
        turf.point([lng, lat]),
        turf.featureCollection(stations) as any,
    );
    if (turf.distance([lng, lat], nearest, { units: "kilometers" }) > 1) {
        return undefined;
    }
    return extractStationName(nearest) || undefined;
};

const placeText = (question: Question, stations: StationPlace[]) => {
    if (question.id === "thermometer") {
        const start = nearestStationName(
            question.data.latA,
            question.data.lngA,
            stations,
        );
        const end = nearestStationName(
            question.data.latB,
            question.data.lngB,
            stations,
        );
        return start || end ? `${start ?? "?"} → ${end ?? "?"}` : undefined;
    }
    return nearestStationName(question.data.lat, question.data.lng, stations);
};

/**
 * An answered question as one line of the question log, like
 * "3 · Radar 2 km · Karlsplatz · Outside · 14:32".
 */
export const QuestionLogRow = ({
    question,
    number,
}: {
    question: Question;
    number: number;
}) => {
    const $allTrainStations = useStore(allTrainStations);
    const place = useMemo(
        () => placeText(question, $allTrainStations),
        [question, $allTrainStations],
    );
    const time = askedAtText(question);

    return (
        <>
            <div
                className="flex items-center gap-2 px-3 py-2"
                data-question-key={question.key}
            >
                <div className="min-w-0 flex-1 text-sm leading-snug">
                    <span className="font-semibold">
                        {number} · {questionTitle(question)}
                    </span>
                    {place && (
                        <span className="text-muted-foreground">
                            {" "}
                            · {place}
                        </span>
                    )}
                    {" · "}
                    <span
                        className={cn(
                            "font-semibold",
                            question.data.status === "no-answer"
                                ? "text-muted-foreground"
                                : "text-sky-300",
                        )}
                    >
                        {answerText(question)}
                    </span>
                    {time && (
                        <span className="text-muted-foreground"> · {time}</span>
                    )}
                    {question.data.hidden && (
                        <span className="text-orange-400"> · hidden</span>
                    )}
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                        question.data.drag = true;
                        question.data.collapsed = false;
                        questionModified();
                    }}
                >
                    Edit
                </Button>
            </div>
            <Separator className="h-1" />
        </>
    );
};
