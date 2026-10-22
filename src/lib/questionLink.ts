import type { PhotoQuestion } from "@/lib/context";
import { compress, decompress } from "@/lib/utils";
import { type Question, questionSchema } from "@/maps/schema";

/*
 * Seekers send a question to the hider as a link. The link holds the whole
 * question, so it works on a phone that knows nothing about the game (on the
 * iPhone, links open in Safari, not in the installed app).
 */

export const QUESTION_URL_PARAM = "ask";

/** Fields that only matter on the seekers' phone (looks, lock, answer state). */
const SEEKER_ONLY_FIELDS = [
    "color",
    "colorA",
    "colorB",
    "collapsed",
    "hidden",
    "drag",
    "status",
];

const linkWith = async (payload: object, appUrl: string) => {
    const url = new URL(appUrl);
    url.search = "";
    url.hash = "";
    url.searchParams.set(
        QUESTION_URL_PARAM,
        await compress(JSON.stringify(payload)),
    );
    return url.toString();
};

/** A link that opens the question on the hider's phone. */
export const questionLink = async (
    question: Question,
    number?: number,
    appUrl = window.location.href,
) => {
    const data = Object.fromEntries(
        Object.entries(question.data).filter(
            ([field]) => !SEEKER_ONLY_FIELDS.includes(field),
        ),
    );
    return linkWith(
        { q: { id: question.id, key: question.key, data }, n: number },
        appUrl,
    );
};

/** A photo question in a link: what the hider's log and clock need. */
export type PhotoLinkQuestion = Pick<
    PhotoQuestion,
    "key" | "photo" | "askedAt" | "sentAt"
>;

/** A link that puts the photo question on the hider's phone, with its clock. */
export const photoLink = async (
    { key, photo, askedAt, sentAt }: PhotoLinkQuestion,
    appUrl = window.location.href,
) => linkWith({ p: { key, photo, askedAt, sentAt } }, appUrl);

export type LinkContent =
    | { question: Question; number?: number; photo?: undefined }
    | { photo: PhotoLinkQuestion; question?: undefined; number?: undefined };

/** The question in a link from `questionLink` or `photoLink`. */
export const readQuestionLink = async (value: string): Promise<LinkContent> => {
    const payload = JSON.parse(await decompress(value));

    if (payload.p) {
        const { key, photo, askedAt, sentAt } = payload.p;
        if (typeof key !== "number" || typeof photo !== "string") {
            throw new Error("Broken photo question link");
        }
        return {
            photo: {
                key,
                photo,
                askedAt: typeof askedAt === "number" ? askedAt : Date.now(),
                sentAt: typeof sentAt === "number" ? sentAt : undefined,
            },
        };
    }

    const question = questionSchema.parse(payload.q);
    question.data.status = "pending";
    question.data.drag = true;
    return {
        question,
        number: typeof payload.n === "number" ? payload.n : undefined,
    };
};
