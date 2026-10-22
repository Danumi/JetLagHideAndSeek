import { useStore } from "@nanostores/react";
import * as turf from "@turf/turf";
import * as React from "react";
import { toast } from "react-toastify";

import CustomInitDialog from "@/components/CustomInitDialog";
import PresetsDialog from "@/components/PresetsDialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Select } from "@/components/ui/select";
import {
    MENU_ITEM_CLASSNAME,
    SidebarMenuItem,
} from "@/components/ui/sidebar-l";
import {
    allTrainStations,
    displayHidingZones,
    drawingQuestionKey,
    isLoading,
    questionModified,
    showAllQuestionTypes,
    triggerLocalRefresh,
} from "@/lib/context";
import { retryTrigger } from "@/lib/loading";
import { findStationLines, type StationLine } from "@/maps/api";
import {
    ADMIN_LEVEL_LABELS,
    type AdminLevel,
    type DeckCard,
    deckSelectGroups,
    MATCHING_DECK,
    matchingCardFor,
} from "@/maps/deck";
import { extractStationName } from "@/maps/geo-utils";
import {
    determineMatchingBoundary,
    findMatchingPlaces,
} from "@/maps/questions/matching";
import {
    determineUnionizedStrings,
    type MatchingQuestion,
    matchingQuestionSchema,
    NO_GROUP,
} from "@/maps/schema";

import { CardNote, QuestionCard } from "./base";

const MATCHING_TYPE_LABELS: Record<string, string> = Object.fromEntries(
    matchingQuestionSchema.options
        .flatMap((x) => determineUnionizedStrings(x.shape.type))
        .map((x) => [(x._def as any).value, x.description]),
);

const applyMatchingCard = (data: MatchingQuestion, card: DeckCard) => {
    if (card.type === "same-length-station") {
        data.lengthComparison = "same";
        data.same = true;
    }
    // Zone questions need a category, so every question keeps one
    (data as any).cat =
        card.adminLevel !== undefined
            ? { adminLevel: card.adminLevel }
            : ((data as any).cat ?? { adminLevel: 3 });
    data.type = card.type as MatchingQuestion["type"];
    questionModified();
};

/** Lets the seekers pick the one line they are riding (rules: "Transit Line"). */
const TrainLinePicker = ({ data }: { data: MatchingQuestion }) => {
    const $allStations = useStore(allTrainStations);
    const $isLoading = useStore(isLoading);
    const $retryTrigger = useStore(retryTrigger);
    const [lines, setLines] = React.useState<StationLine[] | "failed" | null>(
        null,
    );

    const nearest = React.useMemo(() => {
        if ($allStations.length === 0) return null;
        return turf.nearestPoint(
            turf.point([data.lng, data.lat]),
            turf.featureCollection($allStations) as any,
        );
    }, [$allStations, data.lat, data.lng]);
    const stationId: string | undefined = nearest?.properties?.id;
    const stationName = nearest ? extractStationName(nearest) : null;

    React.useEffect(() => {
        let cancelled = false;
        setLines(null);
        if (!stationId || !stationId.includes("/")) return;
        findStationLines(stationId)
            .then((result) => !cancelled && setLines(result))
            .catch(() => !cancelled && setLines("failed"));
        return () => {
            cancelled = true;
        };
    }, [stationId, $retryTrigger]);

    if (!stationId) {
        return (
            <CardNote warning>
                Turn on hiding zones to choose the seekers&apos; line.
            </CardNote>
        );
    }
    if (lines === null) {
        return <CardNote>Loading lines at {stationName}...</CardNote>;
    }
    if (lines === "failed") {
        return (
            <CardNote warning>
                The lines at {stationName} didn&apos;t load.
            </CardNote>
        );
    }
    if (lines.length === 0) {
        return <CardNote warning>No lines found at {stationName}.</CardNote>;
    }

    const chosen = lines.some((line) => line.key === data.lineKey)
        ? data.lineKey!
        : "any";
    return (
        <>
            <SidebarMenuItem className={MENU_ITEM_CLASSNAME}>
                <Select
                    trigger="Seekers' line"
                    options={{
                        any: "Line not chosen (safe eliminations only)",
                        ...Object.fromEntries(
                            lines.map((line) => [line.key, line.label]),
                        ),
                    }}
                    value={chosen}
                    onValueChange={(value) =>
                        questionModified(
                            (data.lineKey =
                                value === "any" ? undefined : value),
                        )
                    }
                    disabled={!data.drag || $isLoading}
                />
            </SidebarMenuItem>
        </>
    );
};

export const MatchingQuestionComponent = ({
    data,
    questionKey,
    sub,
    className,
}: {
    data: MatchingQuestion;
    questionKey: number;
    sub?: string;
    className?: string;
}) => {
    useStore(triggerLocalRefresh);
    const $displayHidingZones = useStore(displayHidingZones);
    const $drawingQuestionKey = useStore(drawingQuestionKey);
    const $isLoading = useStore(isLoading);
    const $showAllQuestionTypes = useStore(showAllQuestionTypes);
    const [customDialogOpen, setCustomDialogOpen] = React.useState(false);
    const [pendingCustomType, setPendingCustomType] = React.useState<
        "custom-zone" | "custom-points" | null
    >(null);
    const card = matchingCardFor(data);

    let questionSpecific = <></>;

    switch (data.type) {
        case "zone":
        case "letter-zone":
            questionSpecific = (
                <>
                    {($showAllQuestionTypes || !card) && (
                        <SidebarMenuItem className={MENU_ITEM_CLASSNAME}>
                            <Select
                                trigger="Administrative level"
                                options={ADMIN_LEVEL_LABELS}
                                value={data.cat.adminLevel.toString()}
                                onValueChange={(value) =>
                                    questionModified(
                                        (data.cat.adminLevel = parseInt(
                                            value,
                                        ) as AdminLevel),
                                    )
                                }
                                disabled={!data.drag || $isLoading}
                            />
                        </SidebarMenuItem>
                    )}
                    {data.type === "letter-zone" && (
                        <CardNote>
                            The borders are simplified by about 100 m so the
                            phone can handle them.
                        </CardNote>
                    )}
                </>
            );
            break;
        case "same-train-line":
            questionSpecific = (
                <>
                    <TrainLinePicker data={data} />
                    <CardNote>
                        The lines come from this app&apos;s map data, so the
                        hider should answer with this app too.
                    </CardNote>
                </>
            );
            break;
        case "street":
            questionSpecific = (
                <CardNote>
                    &quot;Same&quot; keeps everything within 200 m of that
                    street; &quot;different&quot; can&apos;t rule anything out
                    reliably.
                </CardNote>
            );
            break;
        case "landmass":
            questionSpecific = (
                <CardNote>
                    Islands in lakes count as part of the surrounding land.
                </CardNote>
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
                <CardNote>
                    This question only changes the map when you open a hiding
                    zone (tap it on the map or in the Zones list).
                </CardNote>
            );
            break;
        case "custom-zone":
        case "custom-points":
            if (data.drag) {
                questionSpecific = (
                    <>
                        <p className="mb-1 px-1 text-sm text-muted-foreground">
                            To modify the matching{" "}
                            {data.type === "custom-zone" ? "zones" : "points"},
                            enable it:
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
                                disabled={$isLoading}
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
    }

    return (
        <QuestionCard
            question={{ id: "matching", key: questionKey, data }}
            sub={sub}
            className={className}
        >
            <CustomInitDialog
                open={customDialogOpen}
                onOpenChange={setCustomDialogOpen}
                onBlank={async () => {
                    if (!pendingCustomType) return;
                    if (pendingCustomType === "custom-zone") {
                        (data as any).geo = undefined;
                        toast.info("Please draw the zone on the map.");
                    } else {
                        (data as any).geo = [];
                        toast.info("Please draw the points on the map.");
                    }
                    data.type = pendingCustomType;
                    questionModified();
                    setCustomDialogOpen(false);
                }}
                onPrefill={async () => {
                    if (!pendingCustomType) return;
                    if (pendingCustomType === "custom-zone") {
                        (data as any).geo =
                            await determineMatchingBoundary(data);
                    } else {
                        if (
                            data.type === "airport" ||
                            data.type === "major-city" ||
                            data.type === "aquarium-full" ||
                            data.type === "zoo-full" ||
                            data.type === "theme_park-full" ||
                            data.type === "peak-full" ||
                            data.type === "museum-full" ||
                            data.type === "hospital-full" ||
                            data.type === "cinema-full" ||
                            data.type === "library-full" ||
                            data.type === "golf_course-full" ||
                            data.type === "consulate-full" ||
                            data.type === "park-full"
                        ) {
                            (data as any).geo = await findMatchingPlaces(data);
                        } else {
                            (data as any).geo = [];
                            toast.info("Please draw the points on the map.");
                        }
                    }
                    data.type = pendingCustomType;
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
                                          MATCHING_TYPE_LABELS[data.type] ??
                                          data.type,
                                  }
                        }
                        groups={deckSelectGroups(MATCHING_DECK)}
                        value={card ? card.id : `other:${data.type}`}
                        onValueChange={(id) => {
                            const next = MATCHING_DECK.find((c) => c.id === id);
                            if (next) applyMatchingCard(data, next);
                        }}
                        disabled={!data.drag || $isLoading}
                    />
                </SidebarMenuItem>
            )}
            {card?.needsHidingZones && !$displayHidingZones && (
                <CardNote warning>
                    This question needs the hiding zones. Turn them on under
                    Zones → Settings.
                </CardNote>
            )}
            {$showAllQuestionTypes && (
                <SidebarMenuItem className={MENU_ITEM_CLASSNAME}>
                    <Select
                        trigger="Matching Type"
                        options={Object.fromEntries(
                            matchingQuestionSchema.options
                                .filter((x) => x.description === NO_GROUP)
                                .flatMap((x) =>
                                    determineUnionizedStrings(x.shape.type),
                                )
                                .map((x) => [
                                    (x._def as any).value,
                                    x.description,
                                ]),
                        )}
                        groups={matchingQuestionSchema.options
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
                            if (
                                value === "custom-zone" ||
                                value === "custom-points"
                            ) {
                                setPendingCustomType(value);
                                setCustomDialogOpen(true);
                                return;
                            }

                            if (value === "same-length-station") {
                                data.lengthComparison = "same";
                                data.same = true;
                            }

                            // The category should be defined such that no error is thrown if this is a zone question.
                            if (!(data as any).cat) {
                                (data as any).cat = { adminLevel: 3 };
                            }
                            questionModified((data.type = value));
                        }}
                        disabled={!data.drag || $isLoading}
                    />
                </SidebarMenuItem>
            )}
            {card?.hint && <CardNote>{card.hint}</CardNote>}
            {questionSpecific}
        </QuestionCard>
    );
};
