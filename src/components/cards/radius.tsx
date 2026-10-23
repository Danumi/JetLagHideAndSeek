import { useStore } from "@nanostores/react";
import { useState } from "react";

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
    showAllQuestionTypes,
    triggerLocalRefresh,
} from "@/lib/context";
import { t, useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { RADAR_DISTANCES, radarDistanceFor } from "@/maps/deck";
import type { RadiusQuestion } from "@/maps/schema";

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
    useLanguage();
    const $isLoading = useStore(isLoading);
    const $showAllQuestionTypes = useStore(showAllQuestionTypes);
    const distance = radarDistanceFor(data);
    const [chooseDistance, setChooseDistance] = useState(!distance);

    return (
        <QuestionCard
            question={{ id: "radius", key: questionKey, data }}
            sub={sub}
            className={className}
        >
            {/* The distance is in the title; changing it is for experts */}
            {$showAllQuestionTypes && (
                <>
                    <SidebarMenuItem>
                        <div className="grid w-full grid-cols-5 gap-1">
                            {RADAR_DISTANCES.map((option) => (
                                <Button
                                    key={option.label}
                                    variant={
                                        !chooseDistance && distance === option
                                            ? "default"
                                            : "outline"
                                    }
                                    className="h-10 px-1"
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
                                    chooseDistance || !distance
                                        ? "default"
                                        : "outline"
                                }
                                className="h-10 px-1"
                                disabled={!data.drag || $isLoading}
                                onClick={() => setChooseDistance(true)}
                            >
                                {t("card.radar.choose")}
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
                </>
            )}
        </QuestionCard>
    );
};
