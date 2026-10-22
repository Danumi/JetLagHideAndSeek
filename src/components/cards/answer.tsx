import { useStore } from "@nanostores/react";
import { SendIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "react-toastify";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { allTrainStations, questionModified, questions } from "@/lib/context";
import { scrollToQuestion } from "@/lib/gps";
import { questionLink } from "@/lib/questionLink";
import { cn, shareMessage } from "@/lib/utils";
import {
    answerOptions,
    answerText,
    askedAtText,
    currentAnswer,
    isPending,
    questionTitle,
    setAnswer,
    setNoAnswer,
} from "@/maps/answers";
import { ICON_COLORS } from "@/maps/api";
import type { Question } from "@/maps/schema";

import { placeText } from "./location";
import { NearestNote } from "./nearest";

/**
 * The question's number, colored like its pin on the map. An orange ring:
 * the question waits for the hider's answer.
 */
export const QuestionBadge = ({
    question,
    number,
}: {
    question: Question;
    number: number;
}) => {
    const color =
        question.id === "thermometer"
            ? question.data.colorB
            : question.data.color;
    return (
        <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold text-white"
            style={{
                background: ICON_COLORS[color] ?? ICON_COLORS.blue,
                borderColor: isPending(question) ? "#f97316" : "#ffffff",
            }}
        >
            {number}
        </span>
    );
};

/**
 * Big buttons for the hider's answer. Tapping one locks the question, and
 * only then does it change the map.
 */
export const AnswerButtons = ({ question }: { question: Question }) => {
    const pending = question.data.status === "pending";
    const options = answerOptions(question);
    const current =
        question.data.status === "pending"
            ? undefined
            : question.data.status === "no-answer"
              ? "no-answer"
              : (currentAnswer(question) ?? "answered");
    const answer = (value: string) => {
        setAnswer(question, value);
        questionModified();
    };

    return (
        <div className="flex flex-col gap-2">
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
                    onClick={() => answer("place")}
                >
                    Save answer
                </Button>
            )}
            <Button
                variant={current === "no-answer" ? "default" : "outline"}
                className="h-10 font-semibold"
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
export const SendToHider = ({ question }: { question: Question }) => {
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
            className="h-10 bg-violet-600 font-semibold text-white hover:bg-violet-700"
            disabled={busy}
            onClick={send}
        >
            <SendIcon />
            Send to hider
        </Button>
    );
};

/**
 * An answered question as one line of the question log, like
 * "3 · Radar 2 km · Karlsplatz · Outside · 14:32", with what's nearest below.
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
                className="flex items-start gap-2 px-3 py-2"
                data-question-key={question.key}
            >
                <QuestionBadge question={question} number={number} />
                <div className="min-w-0 flex-1 text-sm leading-snug">
                    <span className="font-semibold">
                        {questionTitle(question)}
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
                        <span className="text-muted-foreground">
                            {" "}
                            · hidden on the map
                        </span>
                    )}
                    <NearestNote question={question} />
                </div>
                <Button
                    variant="outline"
                    className="h-10"
                    onClick={() => {
                        question.data.drag = true;
                        questionModified();
                        // Its card moves up to the open questions
                        setTimeout(() => scrollToQuestion(question.key), 100);
                    }}
                >
                    Edit
                </Button>
            </div>
            <Separator className="h-1" />
        </>
    );
};
