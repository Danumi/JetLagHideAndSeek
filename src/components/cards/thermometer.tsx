import { useStore } from "@nanostores/react";

import { triggerLocalRefresh } from "@/lib/context";
import { t, useLanguage } from "@/lib/i18n";
import { formatKilometers, thermometerTraveled } from "@/maps/answers";
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
    const traveled = thermometerTraveled(data);
    // Rounded like on the card, so 0.999 km still counts as 1 km
    const tooShort =
        data.distance !== undefined &&
        Math.round(traveled * 100) < Math.round(data.distance * 100);

    return (
        <QuestionCard
            question={{ id: "thermometer", key: questionKey, data }}
            sub={sub}
            className={className}
        >
            <CardNote>
                {data.distance !== undefined
                    ? t("thermometer.traveled", {
                          traveled: formatKilometers(traveled),
                          distance: formatKilometers(data.distance),
                      })
                    : t("thermometer.traveledOnly", {
                          traveled: formatKilometers(traveled),
                      })}
            </CardNote>
            {tooShort && (
                <CardNote warning>
                    {t("thermometer.tooShortNote", {
                        distance: formatKilometers(data.distance!),
                    })}
                </CardNote>
            )}
            <CardNote>{t("thermometer.note")}</CardNote>
        </QuestionCard>
    );
};
