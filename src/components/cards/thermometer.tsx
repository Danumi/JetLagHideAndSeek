import { useStore } from "@nanostores/react";
import { point } from "@turf/turf";
import { useEffect, useState } from "react";

import { LatitudeLongitude } from "@/components/LatLngPicker";
import { defaultUnit } from "@/lib/context";
import {
    isLoading,
    questionModified,
    questions,
    triggerLocalRefresh,
} from "@/lib/context";
import { arcDistance } from "@/maps/geo-utils";
import type { ThermometerQuestion } from "@/maps/schema";

import { AnswerButtons, numberedTitle } from "./answer";
import { QuestionCard } from "./base";

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
    const $questions = useStore(questions);
    const $isLoading = useStore(isLoading);

    const $defaultUnit = useStore(defaultUnit);
    const DISTANCE_UNIT = $defaultUnit === "meters" ? "meters" : "kilometers";

    const label = numberedTitle($questions, questionKey);

    const hasCoords =
        data.latA !== null &&
        data.lngA !== null &&
        data.latB !== null &&
        data.lngB !== null;
    const [distanceValue, setDistanceValue] = useState<number | null>(null);

    useEffect(() => {
        if (!hasCoords) {
            setDistanceValue(null);
            return;
        }

        let cancelled = false;
        arcDistance(
            point([data.lngA!, data.latA!]),
            point([data.lngB!, data.latB!]),
            DISTANCE_UNIT,
        ).then((distance) => {
            if (!cancelled) setDistanceValue(distance);
        });

        return () => {
            cancelled = true;
        };
    }, [data.latA, data.lngA, data.latB, data.lngB, DISTANCE_UNIT, hasCoords]);

    return (
        <QuestionCard
            questionKey={questionKey}
            label={label}
            sub={sub}
            className={className}
            collapsed={data.collapsed}
            setCollapsed={(collapsed) => {
                data.collapsed = collapsed;
            }}
            locked={!data.drag}
            setLocked={(locked) => questionModified((data.drag = !locked))}
            hidden={data.hidden}
            setHidden={(hidden) => questionModified((data.hidden = hidden))}
        >
            <LatitudeLongitude
                latitude={data.latA}
                longitude={data.lngA}
                label="Start"
                colorName={data.colorA}
                onChange={(lat, lng) => {
                    if (lat !== null) data.latA = lat;
                    if (lng !== null) data.lngA = lng;
                    questionModified();
                }}
                disabled={!data.drag || $isLoading}
            />

            <LatitudeLongitude
                latitude={data.latB}
                longitude={data.lngB}
                label="End"
                colorName={data.colorB}
                onChange={(lat, lng) => {
                    if (lat !== null) data.latB = lat;
                    if (lng !== null) data.lngB = lng;
                    questionModified();
                }}
                disabled={!data.drag || $isLoading}
            />

            {distanceValue !== null && (
                <div className="px-2 text-sm text-muted-foreground">
                    Distance:{" "}
                    <span className="font-medium text-foreground">
                        {DISTANCE_UNIT === "meters"
                            ? `${distanceValue.toFixed(0)} m`
                            : `${distanceValue.toFixed(3)} km`}
                    </span>
                </div>
            )}

            <AnswerButtons
                question={{ id: "thermometer", key: questionKey, data }}
            />
        </QuestionCard>
    );
};
