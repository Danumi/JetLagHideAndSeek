import { useStore } from "@nanostores/react";

import { triggerLocalRefresh } from "@/lib/context";
import type { ThermometerQuestion } from "@/maps/schema";

import { CardNote, QuestionCard } from "./base";

export const ThermometerQuestionComponent = ({
    data,
    questionKey,
    sub,
    className,
}: {
    data: ThermometerQuestion;
    questionKey: number;
    sub?: string;
    className?: string;
}) => {
    useStore(triggerLocalRefresh);

    return (
        <QuestionCard
            question={{ id: "thermometer", key: questionKey, data }}
            sub={sub}
            className={className}
        >
            <CardNote>
                Warmer: the hider is closer to the end than to the start (the
                hollow pin).
            </CardNote>
        </QuestionCard>
    );
};
