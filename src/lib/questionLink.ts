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
    const payload = JSON.stringify({
        q: { id: question.id, key: question.key, data },
        n: number,
    });
    const url = new URL(appUrl);
    url.search = "";
    url.hash = "";
    url.searchParams.set(QUESTION_URL_PARAM, await compress(payload));
    return url.toString();
};

/** The question in a link from `questionLink`. */
export const readQuestionLink = async (value: string) => {
    const payload = JSON.parse(await decompress(value));
    const question = questionSchema.parse(payload.q);
    question.data.status = "pending";
    question.data.drag = true;
    return {
        question,
        number: typeof payload.n === "number" ? payload.n : undefined,
    };
};
