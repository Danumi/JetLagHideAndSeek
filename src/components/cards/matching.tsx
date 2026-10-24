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
import { labelOf, t, tr, useLanguage } from "@/lib/i18n";
import { retryTrigger } from "@/lib/loading";
import { findSeekerLines, type StationLine } from "@/maps/api";
import {
    type AdminLevel,
    adminLevelOptions,
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

const LINE_KINDS = {
    tram: "matching.line.tram",
    bus: "matching.line.bus",
    trolleybus: "matching.line.trolleybus",
} as const;

/** "U4", "S45", "Tram D", "Bus 13A". */
const lineName = (line: StationLine) => {
    const kind = LINE_KINDS[line.route as keyof typeof LINE_KINDS];
    return kind ? t(kind, { ref: line.label }) : line.label;
};

/** Lets the seekers pick the one line they are riding (rules: "Transit Line"). */
const TrainLinePicker = ({ data }: { data: MatchingQuestion }) => {
    useLanguage();
    const $allStations = useStore(allTrainStations);
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
    const station: string = (nearest && extractStationName(nearest)) ?? "";

    React.useEffect(() => {
        let cancelled = false;
        setLines(null);
        if (!stationId || !stationId.includes("/")) return;
        findSeekerLines(stationId, data)
            .then((result) => !cancelled && setLines(result))
            .catch(() => !cancelled && setLines("failed"));
        return () => {
            cancelled = true;
        };
    }, [stationId, data.lat, data.lng, $retryTrigger]);

    if (!stationId) {
        return <CardNote warning>{t("matching.line.noZones")}</CardNote>;
    }
    if (lines === null) {
        return <CardNote>{t("matching.line.loading", { station })}</CardNote>;
    }
    if (lines === "failed") {
        return (
            <CardNote warning>
                {t("matching.line.failed", { station })}
            </CardNote>
        );
    }
    if (lines.length === 0) {
        return (
            <CardNote warning>{t("matching.line.none", { station })}</CardNote>
        );
    }

    const chosen = lines.some((line) => line.key === data.lineKey)
        ? data.lineKey!
        : "any";
    return (
        <>
            <SidebarMenuItem className={MENU_ITEM_CLASSNAME}>
                <Select
                    trigger={t("matching.line.select")}
                    options={{
                        any: t("matching.line.any"),
                        ...Object.fromEntries(
                            lines.map((line) => [line.key, lineName(line)]),
                        ),
                    }}
                    value={chosen}
                    onValueChange={(value) =>
                        questionModified(
                            (data.lineKey =
                                value === "any" ? undefined : value),
                        )
                    }
                    // Not while the map computes: an open question doesn't
                    // change the map, and the line is needed before sending
                    disabled={!data.drag}
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
    useLanguage();
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
                                trigger={t("card.adminLevel")}
                                options={adminLevelOptions()}
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
                        <CardNote>{t("matching.letterZone.note")}</CardNote>
                    )}
                </>
            );
            break;
        case "same-train-line":
            questionSpecific = (
                <>
                    <TrainLinePicker data={data} />
                    <CardNote>{t("matching.line.note")}</CardNote>
                </>
            );
            break;
        case "street":
            questionSpecific = <CardNote>{t("matching.street.note")}</CardNote>;
            break;
        case "landmass":
            questionSpecific = (
                <CardNote>{t("matching.landmass.note")}</CardNote>
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
            questionSpecific = <CardNote>{t("card.onlyInZone")}</CardNote>;
            break;
        case "custom-zone":
        case "custom-points":
            if (data.drag) {
                questionSpecific = (
                    <>
                        <p className="mb-1 px-1 text-sm text-muted-foreground">
                            {t("card.drawBefore", {
                                what: t(
                                    data.type === "custom-zone"
                                        ? "card.drawZones"
                                        : "card.drawMatchingPoints",
                                ),
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
                                disabled={$isLoading}
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
                        toast.info(t("card.drawZone"));
                    } else {
                        (data as any).geo = [];
                        toast.info(t("card.drawPoints"));
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
                            toast.info(t("card.drawPoints"));
                        }
                    }
                    data.type = pendingCustomType;
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
                        trigger={t("card.matchingType")}
                        options={Object.fromEntries(
                            matchingQuestionSchema.options
                                .filter((x) => x.description === NO_GROUP)
                                .flatMap((x) =>
                                    determineUnionizedStrings(x.shape.type),
                                )
                                .map((x) => [
                                    (x._def as any).value,
                                    labelOf(x.description),
                                ]),
                        )}
                        groups={matchingQuestionSchema.options
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
            {card?.hint && <CardNote>{tr(card.hint)}</CardNote>}
            {questionSpecific}
        </QuestionCard>
    );
};
