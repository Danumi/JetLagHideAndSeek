import type { PhotoQuestion } from "@/lib/context";
import {
    type DeckCard,
    matchingCardFor,
    measuringCardFor,
    radarDistanceFor,
} from "@/maps/deck";
import type { Question, RadiusQuestion } from "@/maps/schema";

/*
 * Each card can be asked once a round. Asking it again costs double (the
 * hider draws twice), the third time triple. A card's id tells repeats
 * apart from other cards, on the seekers' phone and on the hider's.
 */

export const deckCardId = (kind: "matching" | "measuring", card: DeckCard) =>
    `${kind}:${card.id}`;

export const radarCardId = (radar: {
    radius: number;
    unit: RadiusQuestion["unit"];
}) =>
    `radar:${radarDistanceFor(radar)?.label ?? `${radar.radius} ${radar.unit}`}`;

export const thermometerCardId = (kilometers: number) =>
    `thermometer:${kilometers}`;

export const photoCardId = (photo: string) => `photo:${photo}`;

/** The card a question was asked with; none where the app can't tell. */
export const questionCardId = (question: Question): string | undefined => {
    switch (question.id) {
        case "matching": {
            const card = matchingCardFor(question.data);
            return card
                ? deckCardId("matching", card)
                : `matching:${question.data.type}`;
        }
        case "measuring": {
            const card = measuringCardFor(question.data);
            return card
                ? deckCardId("measuring", card)
                : `measuring:${question.data.type}`;
        }
        case "radius":
            return radarCardId(question.data);
        case "thermometer":
            // Older thermometers don't know their card
            return question.data.distance === undefined
                ? undefined
                : thermometerCardId(question.data.distance);
        default:
            return undefined;
    }
};

export type Asked = {
    /** How often the card was asked so far. */
    count: number;
    /** When it was asked last, in milliseconds since 1970, if known. */
    last?: number;
};

/** The cards the seekers asked so far this round, by card id. */
export const askedCards = (
    questions: Question[],
    photos: PhotoQuestion[],
): Map<string, Asked> => {
    const asked = new Map<string, Asked>();
    const add = (id: string | undefined, at: number | undefined) => {
        if (!id) return;
        const before = asked.get(id);
        asked.set(id, {
            count: (before?.count ?? 0) + 1,
            last: Math.max(before?.last ?? 0, at ?? 0) || undefined,
        });
    };
    for (const question of questions) {
        add(questionCardId(question), question.data.askedAt);
    }
    for (const photo of photos) {
        add(photoCardId(photo.photo), photo.askedAt);
    }
    return asked;
};
