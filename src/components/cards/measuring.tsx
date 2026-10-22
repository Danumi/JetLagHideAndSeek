import { useStore } from "@nanostores/react";
import { Label } from "@radix-ui/react-label";
import * as React from "react";
import { Suspense, use } from "react";

import CustomInitDialog from "@/components/CustomInitDialog";
import { LatitudeLongitude } from "@/components/LatLngPicker";
import PresetsDialog from "@/components/PresetsDialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Select } from "@/components/ui/select";
import {
    MENU_ITEM_CLASSNAME,
    SidebarMenuItem,
} from "@/components/ui/sidebar-l";
import {
    customInitPreference,
    displayHidingZones,
    drawingQuestionKey,
    isLoading,
    questionModified,
    questions,
    showAllQuestionTypes,
    triggerLocalRefresh,
} from "@/lib/context";
import {
    ADMIN_LEVEL_LABELS,
    type AdminLevel,
    type DeckCard,
    deckSelectGroups,
    MEASURING_DECK,
    measuringCardFor,
} from "@/maps/deck";
import {
    determineMeasuringBoundary,
    findAdminZoneInfo,
} from "@/maps/questions/measuring";
import {
    determineUnionizedStrings,
    type MeasuringQuestion,
    measuringQuestionSchema,
    NO_GROUP,
} from "@/maps/schema";

import { AnswerButtons, numberedTitle } from "./answer";
import { QuestionCard } from "./base";

const MEASURING_TYPE_LABELS: Record<string, string> = Object.fromEntries(
    measuringQuestionSchema.options
        .flatMap((x) => determineUnionizedStrings(x.shape.type))
        .map((x) => [(x._def as any).value, x.description]),
);

const applyMeasuringCard = (data: MeasuringQuestion, card: DeckCard) => {
    if (card.adminLevel !== undefined) {
        (data as any).cat = { adminLevel: card.adminLevel };
    }
    data.type = card.type as MeasuringQuestion["type"];
    questionModified();
};

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
    const $questions = useStore(questions);
    const $displayHidingZones = useStore(displayHidingZones);
    const $drawingQuestionKey = useStore(drawingQuestionKey);
    const $isLoading = useStore(isLoading);
    const $customInitPref = useStore(customInitPreference);
    const $showAllQuestionTypes = useStore(showAllQuestionTypes);
    const [customDialogOpen, setCustomDialogOpen] = React.useState(false);
    const card = measuringCardFor(data);
    const label = numberedTitle($questions, questionKey);

    let questionSpecific = <></>;

    switch (data.type) {
        case "admin-measure":
            questionSpecific = (
                <>
                    {($showAllQuestionTypes || !card) && (
                        <SidebarMenuItem className={MENU_ITEM_CLASSNAME}>
                            <Select
                                trigger="Administrative level"
                                options={ADMIN_LEVEL_LABELS}
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
                    <SidebarMenuItem className={MENU_ITEM_CLASSNAME}>
                        <Suspense
                            fallback={
                                <div className="flex items-center justify-center w-full h-[3rem]">
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="24"
                                        height="24"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        className="animate-spin"
                                    >
                                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                                    </svg>
                                </div>
                            }
                        >
                            <AdminZoneNameDisplay data={data} />
                        </Suspense>
                    </SidebarMenuItem>
                </>
            );
            break;
        case "sea-level":
            questionSpecific = (
                <span className="px-2 text-center">
                    &quot;Closer&quot; means the hider is lower (closer to sea
                    level) than the seekers. Elevation from terrain data,
                    accurate to a few meters.
                </span>
            );
            break;
        case "water":
            questionSpecific = (
                <span className="px-2 text-center">
                    Counts named lakes, ponds, rivers and canals in the game
                    area. Pools, fountains and streams don&apos;t count.
                </span>
            );
            break;
        case "rail-measure":
            questionSpecific = (
                <span className="px-2 text-center">
                    Counts the stations the hiding zones are drawn around
                    (U-Bahn in a Small game).
                </span>
            );
            break;
        case "mcdonalds":
        case "seven11":
            questionSpecific = (
                <span className="px-2 text-center text-orange-500">
                    This question will eliminate hiding zones that don&apos;t
                    fit the criteria. When you click on a zone, the parts of
                    that zone that don&apos;t satisfy the criteria will be
                    eliminated.
                </span>
            );
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
            questionSpecific = (
                <span className="px-2 text-center text-orange-500">
                    This question will only influence the map when you click on
                    a hiding zone in the hiding zone sidebar.
                </span>
            );
            break;
        case "custom-measure":
            if (data.drag) {
                questionSpecific = (
                    <>
                        <p className="px-2 mb-1 text-center text-orange-500">
                            To modify the measuring question, enable it:
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
                            and use the buttons at the bottom left of the map.
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
            {!$showAllQuestionTypes && (
                <SidebarMenuItem className={MENU_ITEM_CLASSNAME}>
                    <Select
                        trigger="Question"
                        options={
                            card
                                ? undefined
                                : {
                                      [`other:${data.type}`]:
                                          MEASURING_TYPE_LABELS[data.type] ??
                                          data.type,
                                  }
                        }
                        groups={deckSelectGroups(MEASURING_DECK)}
                        value={card ? card.id : `other:${data.type}`}
                        onValueChange={(id) => {
                            const next = MEASURING_DECK.find(
                                (c) => c.id === id,
                            );
                            if (next) applyMeasuringCard(data, next);
                        }}
                        disabled={!data.drag || $isLoading}
                    />
                </SidebarMenuItem>
            )}
            {card?.needsHidingZones && !$displayHidingZones && (
                <span className="px-2 text-center text-orange-500">
                    This question needs the hiding zones. Turn them on in the
                    right sidebar.
                </span>
            )}
            {$showAllQuestionTypes && (
                <SidebarMenuItem className={MENU_ITEM_CLASSNAME}>
                    <Select
                        trigger="Measuring Type"
                        options={Object.fromEntries(
                            measuringQuestionSchema.options
                                .filter((x) => x.description === NO_GROUP)
                                .flatMap((x) =>
                                    determineUnionizedStrings(x.shape.type),
                                )
                                .map((x) => [
                                    (x._def as any).value,
                                    x.description,
                                ]),
                        )}
                        groups={measuringQuestionSchema.options
                            .filter((x) => x.description !== NO_GROUP)
                            .map((x) => [
                                x.description,
                                Object.fromEntries(
                                    determineUnionizedStrings(x.shape.type).map(
                                        (x) => [
                                            (x._def as any).value,
                                            x.description,
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
                                if ($customInitPref === "ask") {
                                    setCustomDialogOpen(true);
                                    return;
                                }
                                if ($customInitPref === "blank") {
                                    if (!(data as any).geo) {
                                        (data as any).geo = {
                                            type: "FeatureCollection",
                                            features: [],
                                        };
                                    } else {
                                        (data as any).geo.features = [];
                                    }
                                } else if ($customInitPref === "prefill") {
                                    const boundary =
                                        await determineMeasuringBoundary(data);
                                    if (!(data as any).geo) {
                                        (data as any).geo = {
                                            type: "FeatureCollection",
                                            features: [],
                                        };
                                    }
                                    (data as any).geo.features = boundary
                                        ? boundary
                                        : [];
                                }
                                data.type = value;
                                questionModified();
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
            {questionSpecific}
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
                question={{ id: "measuring", key: questionKey, data }}
            />
        </QuestionCard>
    );
};

const AdminZoneNameDisplay = ({ data }: { data: MeasuringQuestion }) => {
    useStore(triggerLocalRefresh);

    const adminLevel = (data as any).cat?.adminLevel ?? 4;
    const zoneInfo = use(findAdminZoneInfo(data.lat, data.lng, adminLevel));

    // Update the zone name in the data
    if (
        zoneInfo &&
        (data as any).cat &&
        (data as any).cat.zoneName !== zoneInfo.name
    ) {
        (data as any).cat.zoneName = zoneInfo.name;
        questionModified();
    }

    if (!zoneInfo) {
        return (
            <div className="flex items-center justify-center w-full h-[3rem] text-muted-foreground text-sm">
                No zone found
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center w-full h-[3rem]">
            <Label className="text-xs text-muted-foreground">Zone</Label>
            <span className="font-medium text-sm truncate max-w-full">
                {zoneInfo.name}
            </span>
        </div>
    );
};
