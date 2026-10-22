import { useStore } from "@nanostores/react";
import { useState } from "react";

import { LatitudeLongitude } from "@/components/LatLngPicker";
import { PositiveNumberInput } from "@/components/PositiveNumberInput";
import { Button } from "@/components/ui/button";
import {
    MENU_ITEM_CLASSNAME,
    SidebarMenuItem,
} from "@/components/ui/sidebar-l";
import { UnitSelect } from "@/components/UnitSelect";
import {
    isLoading,
    questionModified,
    questions,
    triggerLocalRefresh,
} from "@/lib/context";
import { cn } from "@/lib/utils";
import { RADAR_DISTANCES, radarDistanceFor } from "@/maps/deck";
import type { RadiusQuestion } from "@/maps/schema";

import { AnswerButtons, numberedTitle } from "./answer";
import { QuestionCard } from "./base";

export const RadiusQuestionComponent = ({
    data,
    questionKey,
    sub,
    className,
}: {
    data: RadiusQuestion;
    questionKey: number;
    sub?: string;
    className?: string;
}) => {
    useStore(triggerLocalRefresh);
    const $questions = useStore(questions);
    const $isLoading = useStore(isLoading);
    const distance = radarDistanceFor(data);
    const [chooseDistance, setChooseDistance] = useState(!distance);
    const label = numberedTitle($questions, questionKey);

    return (
        <QuestionCard
            questionKey={questionKey}
            label={label}
            sub={sub}
            className={className}
            collapsed={data.collapsed}
            setCollapsed={(collapsed) => {
                data.collapsed = collapsed; // Doesn't trigger a re-render so no need for questionModified
            }}
            locked={!data.drag}
            setLocked={(locked) => questionModified((data.drag = !locked))}
            hidden={data.hidden}
            setHidden={(hidden) => questionModified((data.hidden = hidden))}
        >
            <SidebarMenuItem>
                <div className="grid w-full grid-cols-5 gap-1 p-2">
                    {RADAR_DISTANCES.map((option) => (
                        <Button
                            key={option.label}
                            variant={
                                !chooseDistance && distance === option
                                    ? "default"
                                    : "outline"
                            }
                            size="sm"
                            className="h-8 px-1 text-xs"
                            disabled={!data.drag || $isLoading}
                            onClick={() => {
                                setChooseDistance(false);
                                data.radius = option.radius;
                                data.unit = option.unit;
                                questionModified();
                            }}
                        >
                            {option.label}
                        </Button>
                    ))}
                    <Button
                        variant={
                            chooseDistance || !distance ? "default" : "outline"
                        }
                        size="sm"
                        className="h-8 px-1 text-xs"
                        disabled={!data.drag || $isLoading}
                        onClick={() => setChooseDistance(true)}
                    >
                        Choose
                    </Button>
                </div>
            </SidebarMenuItem>
            {(chooseDistance || !distance) && (
                <SidebarMenuItem>
                    <div
                        className={cn(
                            MENU_ITEM_CLASSNAME,
                            "gap-2 flex flex-row",
                        )}
                    >
                        <PositiveNumberInput
                            value={data.radius}
                            disabled={!data.drag || $isLoading}
                            onChange={(radius) =>
                                questionModified((data.radius = radius))
                            }
                        />
                        <UnitSelect
                            unit={data.unit}
                            disabled={!data.drag || $isLoading}
                            onChange={(unit) =>
                                questionModified((data.unit = unit))
                            }
                        />
                    </div>
                </SidebarMenuItem>
            )}
            <LatitudeLongitude
                latitude={data.lat}
                longitude={data.lng}
                colorName={data.color}
                onChange={(lat, lng) => {
                    if (lat !== null) {
                        data.lat = lat;
                    }
                    if (lng !== null) {
                        data.lng = lng;
                    }
                    questionModified();
                }}
                disabled={!data.drag || $isLoading}
            />
            <AnswerButtons
                question={{ id: "radius", key: questionKey, data }}
            />
        </QuestionCard>
    );
};
