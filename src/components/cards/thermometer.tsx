import { useStore } from "@nanostores/react";

import { triggerLocalRefresh } from "@/lib/context";
import { t, useLanguage } from "@/lib/i18n";
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
    useLanguage();

    return (
        <QuestionCard
            question={{ id: "thermometer", key: questionKey, data }}
            sub={sub}
            className={className}
        >
            <CardNote>{t("thermometer.note")}</CardNote>
        </QuestionCard>
    );
};
