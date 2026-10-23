import { t } from "@/lib/i18n";

/*
 * How long the hider has to answer, by the rule book: five minutes, photos
 * ten in a Small game. The time starts when the seekers send the question.
 */

export const ANSWER_MINUTES = 5;
export const PHOTO_ANSWER_MINUTES = 10;

/** Late by more than this, the clock only says when the answer was due. */
const LONG_LATE_MS = 60 * 60_000;

/**
 * When the seekers asked: the first time they sent the question to the
 * hider. Until then the clock doesn't run.
 */
export const clockStart = (asked: { sentAt?: number }) => asked.sentAt;

export type Countdown = {
    /** When the answer is due, in milliseconds since 1970. */
    due: number;
    /** Milliseconds until then; below 0 once it's late. */
    left: number;
    /** The last fifth of the time (at least a minute), or late. */
    urgent: boolean;
};

export const countdown = (
    start: number,
    minutes: number,
    now = Date.now(),
): Countdown => {
    const due = start + minutes * 60_000;
    const left = due - now;
    return {
        due,
        left,
        urgent: left <= Math.max(60_000, minutes * 60_000 * 0.2),
    };
};

/** "3:07": minutes and seconds. */
export const formatMinutes = (ms: number) => {
    const seconds = Math.max(0, Math.floor(ms / 1000));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

/** Clock time, like "14:32". */
export const clockTime = (time: number) =>
    new Date(time).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
    });

/** "Answer due 14:37 · 3:07 left", or how late the answer is. */
export const countdownText = ({ due, left }: Countdown) => {
    const time = clockTime(due);
    if (left > 0) {
        // Rounded up: "0:01 left" until it's due
        return t("clock.left", { time, left: formatMinutes(left + 999) });
    }
    if (-left < LONG_LATE_MS) {
        return t("clock.late", { time, late: formatMinutes(-left) });
    }
    return t("clock.lateLong", { time });
};
