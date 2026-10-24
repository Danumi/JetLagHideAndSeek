import { useStore } from "@nanostores/react";
import { MousePointerClickIcon, ScanEyeIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
    addQuestion,
    disabledStations,
    displayHidingZones,
    photoQuestions,
    questions,
    thermometerRun,
    trainStations,
} from "@/lib/context";
import { pickOnMap, questionLocation, showQuestion } from "@/lib/gps";
import { t, useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { answerOptions, isPending, questionTitle } from "@/maps/answers";
import {
    endPreview,
    PREVIEW_KEY,
    previewKey,
    previewZonesShown,
    questionPreview,
    showPreviewAnswer,
} from "@/maps/preview";
import type { DeepPartial, Question } from "@/maps/schema";
import { zonesLeft } from "@/maps/zones";

import { NearestNote } from "./cards/nearest";
import { useWatching } from "./SeekerMap";

const zonesLeftText = (count: number) =>
    count === 1 ? t("preview.oneZoneLeft") : t("preview.zonesLeft", { count });

/**
 * "Just look", above the buttons below the map: the question looked at, its
 * answers (the map shows the one chosen, with how many zones it leaves) and
 * "Ask this question". Nothing here changes the questions or the seekers'
 * shared map, so it works on a phone that shows another seeker's map too.
 */
export const QuestionPreviewBar = () => {
    useLanguage();
    const $preview = useStore(questionPreview);
    const $stations = useStore(trainStations);
    const $disabledStations = useStore(disabledStations);
    const $zonesShown = useStore(previewZonesShown);
    const $displayHidingZones = useStore(displayHidingZones);
    const $questions = useStore(questions);
    const $photoQuestions = useStore(photoQuestions);
    const $thermometerRun = useStore(thermometerRun);
    const watching = useWatching();
    // Zones left after each answer looked at, for the same question and place
    const [counts, setCounts] = useState<Record<string, number>>({});

    const where = $preview
        ? JSON.stringify([$preview.question.id, $preview.question.data])
        : "";
    const ready =
        $displayHidingZones &&
        $preview !== null &&
        $zonesShown === previewKey($preview);
    const left = zonesLeft($stations, $disabledStations).length;

    useEffect(() => setCounts({}), [where, $questions, $disabledStations]);
    useEffect(() => {
        if (ready && $preview) {
            setCounts((known) => ({ ...known, [$preview.answer]: left }));
        }
    }, [ready, left, $preview?.answer]);

    if (!$preview) return null;
    const { question, answer } = $preview;

    // Asked where this phone is, like from "Ask a question"; not while
    // another phone asks or a question still waits for its answer
    const canAsk =
        $preview.atMyLocation &&
        !watching &&
        !$thermometerRun &&
        !$questions.some(isPending) &&
        !$photoQuestions.some((photo) => photo.status === "pending");

    const askIt = async () => {
        const { card } = $preview;
        endPreview();
        const at = await questionLocation();
        if (!at) return;
        const key = Math.random();
        addQuestion({
            ...card,
            key,
            data: {
                ...card.data,
                lat: at.lat,
                lng: at.lng,
                accuracy: at.accuracy,
            },
        } as DeepPartial<Question>);
        showQuestion(key);
    };

    return (
        <div className="flex w-[min(92vw,420px)] flex-col gap-2 rounded-lg border-2 border-rose-600 bg-background p-3 text-foreground shadow-lg">
            <div className="flex items-center gap-2">
                <ScanEyeIcon className="size-5 shrink-0 text-rose-600" />
                <span className="min-w-0 flex-1 truncate font-semibold font-poppins">
                    {t("preview.title", { title: questionTitle(question) })}
                </span>
                <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 shrink-0 rounded-full"
                    title={t("preview.close")}
                    onClick={endPreview}
                >
                    <XIcon className="!size-4" />
                </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
                {answerOptions(question).map((option) => {
                    const shown = option.value === answer;
                    const count = shown
                        ? ready
                            ? left
                            : undefined
                        : counts[option.value];
                    return (
                        <button
                            key={option.value}
                            className={cn(
                                "flex h-14 flex-col items-center justify-center rounded-md border-2 px-2 text-base font-semibold leading-tight transition-colors",
                                shown
                                    ? "border-rose-600 bg-rose-600 text-white"
                                    : "hover:bg-accent",
                            )}
                            aria-pressed={shown}
                            onClick={() => showPreviewAnswer(option.value)}
                        >
                            {option.label}
                            {$displayHidingZones &&
                                (count !== undefined || shown) && (
                                    <span className="text-xs font-normal">
                                        {count !== undefined
                                            ? zonesLeftText(count)
                                            : "…"}
                                    </span>
                                )}
                        </button>
                    );
                })}
            </div>
            <NearestNote question={question} />
            <p className="text-xs text-muted-foreground">{t("preview.note")}</p>
            <div className="flex gap-2">
                <Button
                    variant="outline"
                    className="h-10 flex-1"
                    onClick={() => pickOnMap({ questionKey: PREVIEW_KEY })}
                >
                    <MousePointerClickIcon />
                    {t("location.pickOnMap")}
                </Button>
                {canAsk && (
                    <Button
                        className="h-10 flex-1 bg-blue-600 text-white hover:bg-blue-700"
                        onClick={askIt}
                    >
                        {t("preview.ask")}
                    </Button>
                )}
            </div>
        </div>
    );
};
