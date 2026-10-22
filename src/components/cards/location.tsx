import { useStore } from "@nanostores/react";
import * as turf from "@turf/turf";
import { LocateIcon, MapPinIcon, MousePointerClickIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { allTrainStations, type PickTarget } from "@/lib/context";
import { moveToMyLocation, pickOnMap } from "@/lib/gps";
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

/** One point of a question with "Use my location" and "Pick on map". */
const PointRow = ({
    label,
    lat,
    lng,
    number,
    target,
    disabled,
}: {
    label: string;
    lat: number;
    lng: number;
    number: number;
    target: PickTarget;
    disabled?: boolean;
}) => {
    const $allTrainStations = useStore(allTrainStations);
    const station = nearestStationName(lat, lng, $allTrainStations);

    return (
        <div className="flex flex-col gap-2 rounded-md border p-2">
            <div className="flex items-center gap-1.5 text-sm">
                <MapPinIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-muted-foreground">{label}:</span>
                <span className="min-w-0 truncate font-semibold">
                    {station ? `near ${station}` : `pin ${number} on the map`}
                </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
                <Button
                    variant="outline"
                    className="h-10 px-2"
                    disabled={disabled}
                    onClick={() => moveToMyLocation(target)}
                >
                    <LocateIcon />
                    Use my location
                </Button>
                <Button
                    variant="outline"
                    className="h-10 px-2"
                    disabled={disabled}
                    onClick={() => pickOnMap(target)}
                >
                    <MousePointerClickIcon />
                    Pick on map
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
export const QuestionLocation = ({
    question,
    number,
}: {
    question: Question;
    number: number;
}) => {
    const disabled = !question.data.drag;

    if (question.id === "thermometer") {
        return (
            <>
                <PointRow
                    label="Start"
                    lat={question.data.latA}
                    lng={question.data.lngA}
                    number={number}
                    target={{ questionKey: question.key, point: "start" }}
                    disabled={disabled}
                />
                <PointRow
                    label="End"
                    lat={question.data.latB}
                    lng={question.data.lngB}
                    number={number}
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
            label="Asked at"
            lat={question.data.lat}
            lng={question.data.lng}
            number={number}
            target={{ questionKey: question.key }}
            disabled={disabled}
        />
    );
};
