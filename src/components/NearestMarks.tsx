import { useStore } from "@nanostores/react";
import * as turf from "@turf/turf";
import { CircleMarker, GeoJSON, Pane, Tooltip } from "react-leaflet";

import { questions } from "@/lib/context";
import { useLanguage } from "@/lib/i18n";
import { isLogged } from "@/maps/answers";
import { ICON_COLORS } from "@/maps/api";
import { markLabel } from "@/maps/nearest";
import type { Question } from "@/maps/schema";

import { useNearest } from "./cards/nearest";

const NearestMark = ({ question }: { question: Question }) => {
    useLanguage();
    const nearest = useNearest(question);

    if (nearest === null || typeof nearest === "string" || !nearest.mark) {
        return null;
    }

    const { mark } = nearest;
    const label = markLabel(nearest);
    const color =
        ICON_COLORS[
            (question.data as { color?: keyof typeof ICON_COLORS }).color ??
                "blue"
        ] ?? ICON_COLORS.blue;

    return (
        <>
            {mark.lines && mark.lines.length > 0 && (
                <GeoJSON
                    // Leaflet keeps the data it was made with
                    key={`${mark.name}:${mark.at.join(",")}`}
                    data={turf.featureCollection(mark.lines)}
                    style={{ color, weight: 5, opacity: 0.85 }}
                    interactive={false}
                    pane="nearest"
                />
            )}
            <CircleMarker
                center={[mark.at[1], mark.at[0]]}
                radius={7}
                pathOptions={{
                    color: "#ffffff",
                    weight: 2,
                    fillColor: color,
                    fillOpacity: 1,
                }}
                interactive={false}
                pane="nearest"
            >
                <Tooltip
                    permanent
                    direction="top"
                    offset={[0, -8]}
                    className="!font-semibold"
                >
                    {label}
                </Tooltip>
            </CircleMarker>
        </>
    );
};

/**
 * What open questions are about, marked on the map with its name: the
 * nearest museum as a dot, the nearest river or railway line as a line.
 */
export const NearestMarks = () => {
    const $questions = useStore(questions);

    return (
        // Above the grey area, below the blue dot; taps go through to the zones
        <Pane name="nearest" style={{ zIndex: 420, pointerEvents: "none" }}>
            {$questions
                .filter(
                    (question) =>
                        (question.id === "matching" ||
                            question.id === "measuring") &&
                        !isLogged(question) &&
                        !question.data.hidden,
                )
                .map((question) => (
                    <NearestMark key={question.key} question={question} />
                ))}
        </Pane>
    );
};
