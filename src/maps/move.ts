import {
    disabledStations,
    hiderPlacedAt,
    hiderZoneId,
    keptZonesRuledOut,
    questions,
    selectedZoneId,
} from "@/lib/context";
import { isLogged } from "@/maps/answers";
import { gameClock, pauseGameClock } from "@/maps/gameClock";

/*
 * The Move card: the hider sets up a new zone at another station. The
 * answers so far were about the old zone, so they stop counting on the
 * map (hidden, still in the log); the hiding time doesn't run meanwhile.
 */

/** What a move changes, to undo it. */
export type BeforeMove = {
    questions: ReturnType<typeof questions.get>;
    disabledStations: string[];
    keptZonesRuledOut: string[];
    hiderZoneId: string;
    gameClock: ReturnType<typeof gameClock.get>;
};

/** Answered questions stop changing the map; open ones stay as they are. */
const hideAnswers = () =>
    questions.set(
        questions
            .get()
            .map((question) =>
                isLogged(question) && !question.data.hidden
                    ? { ...question, data: { ...question.data, hidden: true } }
                    : question,
            ) as ReturnType<typeof questions.get>,
    );

const remember = (): BeforeMove => ({
    questions: questions.get(),
    disabledStations: disabledStations.get(),
    keptZonesRuledOut: keptZonesRuledOut.get(),
    hiderZoneId: hiderZoneId.get(),
    gameClock: gameClock.get(),
});

/** Seekers: the hider played Move. All zones are possible again. */
export const hiderMoved = (now = Date.now()) => {
    const before = remember();
    hideAnswers();
    disabledStations.set([]);
    keptZonesRuledOut.set([]);
    selectedZoneId.set("");
    pauseGameClock(now);
    return before;
};

/** The hider plays Move: they choose their new zone once they're there. */
export const hiderMoves = (now = Date.now()) => {
    const before = remember();
    hideAnswers();
    hiderZoneId.set("");
    // Wherever the hider set their location by hand, they leave it
    hiderPlacedAt.set(null);
    pauseGameClock(now);
    return before;
};

export const undoMove = (before: BeforeMove) => {
    questions.set(before.questions);
    disabledStations.set(before.disabledStations);
    keptZonesRuledOut.set(before.keptZonesRuledOut);
    hiderZoneId.set(before.hiderZoneId);
    gameClock.set(before.gameClock);
};
