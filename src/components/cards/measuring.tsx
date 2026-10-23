import { useStore } from "@nanostores/react";
import * as React from "react";

import CustomInitDialog from "@/components/CustomInitDialog";
import PresetsDialog from "@/components/PresetsDialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Select } from "@/components/ui/select";
import {
    MENU_ITEM_CLASSNAME,
    SidebarMenuItem,
} from "@/components/ui/sidebar-l";
import {
    displayHidingZones,
    drawingQuestionKey,
    isLoading,
    questionModified,
    showAllQuestionTypes,
    triggerLocalRefresh,
} from "@/lib/context";
import { labelOf, t, tr, useLanguage } from "@/lib/i18n";
import {
    type AdminLevel,
    adminLevelOptions,
    measuringCardFor,
} from "@/maps/deck";
import { determineMeasuringBoundary } from "@/maps/questions/measuring";
import {
    determineUnionizedStrings,
    type MeasuringQuestion,
    measuringQuestionSchema,
    NO_GROUP,
} from "@/maps/schema";

import { CardNote, QuestionCard } from "./base";

export const MeasuringQuestionComponent = ({
    data,
    questionKey,
    sub,
    className,
}: {
    data: MeasuringQuestion;
    questionKey: number;
    sub?: string;
    className?: string;
}) => {
    useStore(triggerLocalRefresh);
    useLanguage();
    const $displayHidingZones = useStore(displayHidingZones);
    const $drawingQuestionKey = useStore(drawingQuestionKey);
    const $isLoading = useStore(isLoading);
    const $showAllQuestionTypes = useStore(showAllQuestionTypes);
    const [customDialogOpen, setCustomDialogOpen] = React.useState(false);
    const card = measuringCardFor(data);

    let questionSpecific = <></>;

    switch (data.type) {
        case "admin-measure":
            questionSpecific = (
                <>
                    {($showAllQuestionTypes || !card) && (
                        <SidebarMenuItem className={MENU_ITEM_CLASSNAME}>
                            <Select
                                trigger={t("card.adminLevel")}
                                options={adminLevelOptions()}
                                value={(
                                    (data as any).cat?.adminLevel ?? 4
                                ).toString()}
                                onValueChange={(value) => {
                                    if (!(data as any).cat) {
                                        (data as any).cat = { adminLevel: 4 };
                                    }
                                    (data as any).cat.adminLevel = parseInt(
                                        value,
                                    ) as AdminLevel;
                                    (data as any).cat.zoneName = undefined;
                                    questionModified();
                                }}
                                disabled={!data.drag || $isLoading}
                            />
                        </SidebarMenuItem>
                    )}
                </>
            );
            break;
        case "sea-level":
            questionSpecific = (
                <CardNote>{t("measuring.seaLevel.note")}</CardNote>
            );
            break;
        case "water":
            questionSpecific = <CardNote>{t("measuring.water.note")}</CardNote>;
            break;
        case "mcdonalds":
        case "seven11":
            questionSpecific = <CardNote>{t("measuring.zones.note")}</CardNote>;
            break;
        case "aquarium":
        case "hospital":
        case "peak":
        case "museum":
        case "theme_park":
        case "zoo":
        case "cinema":
        case "library":
        case "golf_course":
        case "consulate":
        case "park":
            questionSpecific = <CardNote>{t("card.onlyInZone")}</CardNote>;
            break;
        case "custom-measure":
            if (data.drag) {
                questionSpecific = (
                    <>
                        <p className="mb-1 px-1 text-sm text-muted-foreground">
                            {t("card.drawBefore", {
                                what: t("card.drawMeasuring"),
                            })}
                            <Checkbox
                                className="mx-1 my-1"
                                checked={$drawingQuestionKey === questionKey}
                                onCheckedChange={(checked) => {
                                    if (checked) {
                                        drawingQuestionKey.set(questionKey);
                                    } else {
                                        drawingQuestionKey.set(-1);
                                    }
                                }}
                                disabled={!data.drag || $isLoading}
                            />
                            {t("card.drawAfter")}
                        </p>
                        <div className="flex justify-center mb-2">
                            <PresetsDialog
                                data={data}
                                presetTypeHint={data.type}
                            />
                        </div>
                    </>
                );
            }
            break;
    }

    return (
        <QuestionCard
            question={{ id: "measuring", key: questionKey, data }}
            sub={sub}
            className={className}
        >
            <CustomInitDialog
                open={customDialogOpen}
                onOpenChange={setCustomDialogOpen}
                onBlank={async () => {
                    if (!(data as any).geo) {
                        (data as any).geo = {
                            type: "FeatureCollection",
                            features: [],
                        };
                    } else {
                        (data as any).geo.features = [];
                    }
                    data.type = "custom-measure";
                    questionModified();
                    setCustomDialogOpen(false);
                }}
                onPrefill={async () => {
                    const boundary = await determineMeasuringBoundary(data);
                    if (!(data as any).geo) {
                        (data as any).geo = {
                            type: "FeatureCollection",
                            features: [],
                        };
                    }
                    (data as any).geo.features = boundary ? boundary : [];
                    data.type = "custom-measure";
                    questionModified();
                    setCustomDialogOpen(false);
                }}
            />
            {card?.needsHidingZones && !$displayHidingZones && (
                <CardNote warning>{t("card.needsZones")}</CardNote>
            )}
            {$showAllQuestionTypes && (
                <SidebarMenuItem className={MENU_ITEM_CLASSNAME}>
                    <Select
                        trigger={t("card.measuringType")}
                        options={Object.fromEntries(
                            measuringQuestionSchema.options
                                .filter((x) => x.description === NO_GROUP)
                                .flatMap((x) =>
                                    determineUnionizedStrings(x.shape.type),
                                )
                                .map((x) => [
                                    (x._def as any).value,
                                    labelOf(x.description),
                                ]),
                        )}
                        groups={measuringQuestionSchema.options
                            .filter((x) => x.description !== NO_GROUP)
                            .map((x) => [
                                labelOf(x.description),
                                Object.fromEntries(
                                    determineUnionizedStrings(x.shape.type).map(
                                        (x) => [
                                            (x._def as any).value,
                                            labelOf(x.description),
                                        ],
                                    ),
                                ),
                            ])
                            .reduce(
                                (acc, [key, value]) => {
                                    const values = {
                                        disabled: !$displayHidingZones,
                                        options: value,
                                    };

                                    if (acc[key]) {
                                        acc[key].options = {
                                            ...acc[key].options,
                                            ...value,
                                        };
                                    } else {
                                        acc[key] = values;
                                    }

                                    return acc;
                                },
                                {} as Record<
                                    string,
                                    {
                                        disabled: boolean;
                                        options: Record<string, string>;
                                    }
                                >,
                            )}
                        value={data.type}
                        onValueChange={async (value) => {
                            if (value === "custom-measure") {
                                setCustomDialogOpen(true);
                                return;
                            }
                            if (
                                value === "admin-measure" &&
                                !(data as any).cat
                            ) {
                                (data as any).cat = { adminLevel: 4 };
                            }
                            data.type = value;
                            questionModified();
                        }}
                        disabled={!data.drag || $isLoading}
                    />
                </SidebarMenuItem>
            )}
            {card?.hint && <CardNote>{tr(card.hint)}</CardNote>}
            {questionSpecific}
        </QuestionCard>
    );
};
