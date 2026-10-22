import { useStore } from "@nanostores/react";
import * as turf from "@turf/turf";
import { LocateIcon, MapPinIcon, MousePointerClickIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { allTrainStations, type PickTarget } from "@/lib/context";
import { IMPRECISE_METERS, moveToMyLocation, pickOnMap } from "@/lib/gps";
import { t, useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { StationPlace } from "@/maps/api";
import { extractStationName } from "@/maps/geo-utils";
import type { Question } from "@/maps/schema";

/** Name of the station nearest to a point, if one is within 1 km. */
const nearestStationName = (
    lat: number,
    lng: number,
    stations: StationPlace[],
) => {
    if (stations.length === 0) return undefined;
    const nearest = turf.nearestPoint(
        turf.point([lng, lat]),
        turf.featureCollection(stations) as any,
    );
    if (turf.distance([lng, lat], nearest, { units: "kilometers" }) > 1) {
        return undefined;
    }
    return extractStationName(nearest) || undefined;
};

/** Where a question was asked, like "Karlsplatz" or "Karlsplatz → Praterstern". */
export const placeText = (question: Question, stations: StationPlace[]) => {
    if (question.id === "thermometer") {
        const start = nearestStationName(
            question.data.latA,
            question.data.lngA,
            stations,
        );
        const end = nearestStationName(
            question.data.latB,
            question.data.lngB,
            stations,
        );
        return start || end ? `${start ?? "?"} → ${end ?? "?"}` : undefined;
    }
    return nearestStationName(question.data.lat, question.data.lng, stations);
};

/**
 * One point of a question with "Use my location" and "Pick on map", and how
 * precise its GPS position was (`accuracy` in meters, none when set by hand).
 */
const PointRow = ({
    label,
    lat,
    lng,
    accuracy,
    target,
    disabled,
}: {
    label: string;
    lat: number;
    lng: number;
    accuracy?: number;
    target: PickTarget;
    disabled?: boolean;
}) => {
    useLanguage();
    const $allTrainStations = useStore(allTrainStations);
    const station = nearestStationName(lat, lng, $allTrainStations);
    const meters = accuracy === undefined ? undefined : Math.round(accuracy);
    const imprecise =
        !disabled && meters !== undefined && meters > IMPRECISE_METERS;

    return (
        <div className="flex flex-col gap-2 rounded-md border p-2">
            <div className="flex items-center gap-1.5 text-sm">
                <MapPinIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-muted-foreground">{label}:</span>
                <span className="min-w-0 truncate font-semibold">
                    {station
                        ? t("location.near", { station })
                        : t("location.pin")}
                </span>
                {meters !== undefined && (
                    <span
                        className={cn(
                            "ml-auto shrink-0",
                            imprecise
                                ? "text-red-400"
                                : "text-muted-foreground",
                        )}
                        title={t("location.accuracyTitle")}
                    >
                        ±{meters} m
                    </span>
                )}
            </div>
            {imprecise && (
                <p className="text-sm text-red-400">
                    {t("location.imprecise", { meters })}
                </p>
            )}
            <div className="grid grid-cols-2 gap-2">
                <Button
                    variant="outline"
                    className="h-10 px-2"
                    disabled={disabled}
                    onClick={() => moveToMyLocation(target)}
                >
                    <LocateIcon />
                    {t("location.useMine")}
                </Button>
                <Button
                    variant="outline"
                    className="h-10 px-2"
                    disabled={disabled}
                    onClick={() => pickOnMap(target)}
                >
                    <MousePointerClickIcon />
                    {t("location.pickOnMap")}
                </Button>
            </div>
        </div>
    );
};

/**
 * Where the question was asked (a thermometer: where it started and ended).
 * The point moves with "Use my location", "Pick on map" or by dragging its
 * pin on the map.
 */
export const QuestionLocation = ({ question }: { question: Question }) => {
    useLanguage();
    const disabled = !question.data.drag;

    if (question.id === "thermometer") {
        return (
            <>
                <PointRow
                    label={t("location.start")}
                    lat={question.data.latA}
                    lng={question.data.lngA}
                    accuracy={question.data.accuracyA}
                    target={{ questionKey: question.key, point: "start" }}
                    disabled={disabled}
                />
                <PointRow
                    label={t("location.end")}
                    lat={question.data.latB}
                    lng={question.data.lngB}
                    accuracy={question.data.accuracyB}
                    target={{ questionKey: question.key, point: "end" }}
                    disabled={disabled}
                />
            </>
        );
    }

    // Drawn zones have no point
    if (question.id === "matching" && question.data.type === "custom-zone") {
        return null;
    }

    return (
        <PointRow
            label={t("location.askedAt")}
            lat={question.data.lat}
            lng={question.data.lng}
            accuracy={question.data.accuracy}
            target={{ questionKey: question.key }}
            disabled={disabled}
        />
    );
};
