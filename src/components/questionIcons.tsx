import {
    EqualIcon,
    type LucideIcon,
    RadarIcon,
    RulerIcon,
    ThermometerIcon,
    WaypointsIcon,
} from "lucide-react";

import type { Question } from "@/maps/schema";

/*
 * One symbol per kind of question, the same on its map pin, its card, its
 * line in the question log and in "Ask a question": a radar, a thermometer,
 * "=" for matching ("the same as mine?"), a ruler for measuring.
 */

export const QUESTION_ICONS: Record<Question["id"], LucideIcon> = {
    radius: RadarIcon,
    thermometer: ThermometerIcon,
    matching: EqualIcon,
    measuring: RulerIcon,
    tentacles: WaypointsIcon,
};

/** The same symbols as SVG markup (Lucide, ISC license), for the map pins. */
const ICON_SVG: Record<Question["id"], string> = {
    radius: '<path d="M19.07 4.93A10 10 0 0 0 6.99 3.34"/><path d="M4 6h.01"/><path d="M2.29 9.62A10 10 0 1 0 21.31 8.35"/><path d="M16.24 7.76A6 6 0 1 0 8.23 16.67"/><path d="M12 18h.01"/><path d="M17.99 11.66A6 6 0 0 1 15.77 16.67"/><circle cx="12" cy="12" r="2"/><path d="m13.41 10.59 5.66-5.66"/>',
    thermometer: '<path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/>',
    matching:
        '<line x1="5" x2="19" y1="9" y2="9"/><line x1="5" x2="19" y1="15" y2="15"/>',
    measuring:
        '<path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z"/><path d="m14.5 12.5 2-2"/><path d="m11.5 9.5 2-2"/><path d="m8.5 6.5 2-2"/><path d="m17.5 15.5 2-2"/>',
    tentacles:
        '<circle cx="12" cy="4.5" r="2.5"/><path d="m10.2 6.3-3.9 3.9"/><circle cx="4.5" cy="12" r="2.5"/><path d="M7 12h10"/><circle cx="19.5" cy="12" r="2.5"/><path d="m13.8 17.7 3.9-3.9"/><circle cx="12" cy="19.5" r="2.5"/>',
};

export const questionIconSvg = (
    id: Question["id"],
    size: number,
    color: string,
) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${ICON_SVG[id]}</svg>`;
