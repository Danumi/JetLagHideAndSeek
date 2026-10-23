import { useStore } from "@nanostores/react";
import {
    CameraIcon,
    ClipboardPasteIcon,
    LayersIcon,
    LoaderCircleIcon,
    LocateFixedIcon,
    MapIcon,
    MapPinIcon,
    PlusIcon,
    SendIcon,
    SettingsIcon,
    TriangleAlertIcon,
    VenetianMaskIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";

import { Button } from "@/components/ui/button";
import { RawInput } from "@/components/ui/input";
import {
    type ChatQuestionKind,
    hiderInbox,
    type HiderInboxEntry,
    hiderMode,
    hiderScreenOpen,
    hiderZoneId,
    photoQuestions,
    questions,
    settingsOpen,
} from "@/lib/context";
import { findPrecisePosition } from "@/lib/gps";
import { t, tr, useLanguage } from "@/lib/i18n";
import { loadingTasks, retryTrigger } from "@/lib/loading";
import {
    QUESTION_URL_PARAM,
    questionInText,
    readQuestionLink,
} from "@/lib/questionLink";
import { questionLinkRole, setRole } from "@/lib/role";
import { cn, shareMessage } from "@/lib/utils";
import { clockTime } from "@/maps/deadline";
import { PHOTO_DECK, photoCardFor } from "@/maps/deck";
import { type HiderAnswer, STATION_TYPES, workOutAnswer } from "@/maps/hider";
import {
    addEntryByHand,
    answerLabel,
    answerMessage,
    answerMinutes,
    cardDraw,
    CHAT_KIND_NAMES,
    entryTitle,
    isOpen,
    markAnswered,
    receiveEntry,
    removeEntry,
    reopenEntry,
    type SentAnswer,
} from "@/maps/hiderLog";
import { hiderZoneCheck, zoneCheckText } from "@/maps/hidingZoneCheck";
import { hiderEntryRuleId } from "@/maps/rules";

import { AnswerClock } from "./AnswerClock";
import { GameClockCard } from "./GameClock";
import { RuleButton } from "./HelpDialog";
import { showActionToast, showUndoToast } from "./UndoToast";

/** Where the hider's location comes from. */
type Fix =
    /** `accuracy`: of the most precise position so far, in meters. */
    | { state: "locating"; accuracy?: number }
    | { state: "failed" }
    | {
          state: "gps";
          latitude: number;
          longitude: number;
          accuracy: number;
          at: number;
      }
    /** The violet H marker on the map, placed by hand. */
    | { state: "marker" };

type Result =
    | { key: number; state: "working" }
    | { key: number; state: "done"; answer: HiderAnswer }
    | { key: number; state: "error"; message: string };

const removeUrlParam = (param: string) => {
    const url = new URL(window.location.href);
    url.searchParams.delete(param);
    window.history.replaceState({}, "", url);
};

/** Worse than this, the zone check may be wrong (e.g. underground). */
const POOR_GPS_METERS = 50;

/**
 * Whether the hider is in their hiding zone, live from the blue dot. Until
 * they chose one: the zone they are in, to choose it.
 */
const ZoneCheckCard = () => {
    const $zoneCheck = useStore(hiderZoneCheck);
    if (!$zoneCheck) return null;

    const { title, detail } = zoneCheckText($zoneCheck);
    const { chosen, inside } = $zoneCheck;
    const showMap = () => {
        hiderScreenOpen.set(false);
        toast.info(t("hider.chooseHint"), {
            autoClose: 4000,
            toastId: "choose-zone-hint",
        });
    };

    return (
        <div
            className={cn(
                "flex flex-col gap-3 rounded-lg border-2 p-3",
                !chosen
                    ? "border-violet-600 bg-violet-600/10"
                    : inside
                      ? "border-green-600 bg-green-600/10"
                      : "border-orange-500 bg-orange-500/10",
            )}
        >
            <div className="flex items-center gap-3">
                {!chosen ? (
                    <MapPinIcon className="size-6 shrink-0 text-violet-500" />
                ) : inside ? (
                    <MapPinIcon className="size-6 shrink-0 text-green-500" />
                ) : (
                    <TriangleAlertIcon className="size-6 shrink-0 text-orange-500" />
                )}
                <div className="min-w-0 flex-1">
                    <div className="font-semibold">{title}</div>
                    <div className="text-sm text-muted-foreground">
                        {detail}
                    </div>
                    {($zoneCheck.accuracy ?? 0) > POOR_GPS_METERS && (
                        <div className="text-xs text-orange-400">
                            {t("hider.poorGps", {
                                meters: Math.round($zoneCheck.accuracy ?? 0),
                            })}
                        </div>
                    )}
                </div>
                {chosen && (
                    <Button variant="outline" size="sm" onClick={showMap}>
                        {t("hider.change")}
                    </Button>
                )}
            </div>
            {!chosen && (
                <div className="flex flex-col gap-2">
                    {inside && (
                        <Button
                            className="h-11 bg-violet-700 font-semibold text-white hover:bg-violet-800"
                            onClick={() => hiderZoneId.set($zoneCheck.id)}
                        >
                            {t("hider.choose", {
                                station: $zoneCheck.station,
                            })}
                        </Button>
                    )}
                    <Button variant="outline" onClick={showMap}>
                        {inside
                            ? t("hider.chooseAnother")
                            : t("hider.chooseOnMap")}
                    </Button>
                </div>
            )}
        </div>
    );
};

/** A question link opened on this phone: the hider's phone answers it. */
const receiveQuestionLink = (entry: HiderInboxEntry) => {
    receiveEntry(entry);

    const role = questionLinkRole();
    if (role === "hider") {
        hiderScreenOpen.set(true);
        return;
    }

    if (role === "seeker") {
        showActionToast(
            t("hider.forHider"),
            t("role.hiding"),
            () => setRole("hider"),
            10000,
        );
        return;
    }

    setRole("hider");
    showActionToast(
        t("hider.nowHider"),
        t("role.seeking"),
        () => setRole("seeker"),
        10000,
    );
};

/**
 * Puts the question of a link on this phone, from the address or pasted.
 * The question's key, unless the link is broken or the phone's own question.
 */
const takeQuestionLink = async (value: string) => {
    try {
        const { question, number, photo } = await readQuestionLink(value);

        const key = question?.key ?? photo!.key;
        const inInbox = hiderInbox.get().some((x) => x.key === key);
        const own = question
            ? questions.get().some((q) => q.key === key)
            : photoQuestions.get().some((p) => p.key === key);
        if (own && !inInbox) {
            toast.info(t("hider.ownQuestion"), { autoClose: 8000 });
            return undefined;
        }

        const receivedAt = Date.now();
        receiveQuestionLink(
            question
                ? {
                      key,
                      question,
                      number,
                      askedAt:
                          question.data.sentAt ??
                          question.data.askedAt ??
                          receivedAt,
                      receivedAt,
                  }
                : {
                      key,
                      photo: photo!.photo,
                      askedAt: photo!.sentAt ?? photo!.askedAt,
                      receivedAt,
                  },
        );
        return key;
    } catch (error) {
        console.log(error);
        toast.error(t("hider.brokenLink"));
        return undefined;
    }
};

/** An iPhone's browser, not the app on its home screen: each keeps its own data. */
const inIphoneBrowser = () =>
    (/iPhone|iPad|iPod/.test(navigator.userAgent) ||
        // iPads say they are Macs
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) &&
    !(navigator as { standalone?: boolean }).standalone;

/**
 * For the app on an iPhone's home screen: links from the chat open in
 * Safari, so the hider copies them and pastes them here.
 */
const PasteLink = ({ onPasted }: { onPasted: (key: number) => void }) => {
    useLanguage();
    const [open, setOpen] = useState(false);
    const [text, setText] = useState("");

    /** Whether the text had a question link in it. */
    const take = async (pasted: string) => {
        const value = questionInText(pasted);
        if (!value) return false;
        const key = await takeQuestionLink(value);
        if (key !== undefined) onPasted(key);
        setOpen(false);
        setText("");
        return true;
    };

    const paste = async () => {
        try {
            if (await take(await navigator.clipboard.readText())) return;
        } catch {
            // No access to the clipboard: the hider pastes into the field
        }
        setOpen(true);
    };

    if (!open) {
        return (
            <Button variant="outline" onClick={paste}>
                <ClipboardPasteIcon />
                {t("hider.paste")}
            </Button>
        );
    }

    return (
        <div className="flex flex-col gap-3 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{t("hider.paste")}</span>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                        setOpen(false);
                        setText("");
                    }}
                >
                    {t("common.cancel")}
                </Button>
            </div>
            <p className="text-sm text-muted-foreground">
                {t("hider.pasteHelp")}
            </p>
            <RawInput
                autoFocus
                inputMode="url"
                placeholder={t("hider.pastePlaceholder")}
                value={text}
                onChange={(e) => {
                    setText(e.target.value);
                    take(e.target.value);
                }}
            />
            {text.trim() !== "" && !questionInText(text) && (
                <p className="text-sm text-orange-400">
                    {t("hider.pasteNoLink")}
                </p>
            )}
        </div>
    );
};

/** After answering: the cards the hider draws now, or none when late. */
const CardDraw = ({
    entry,
    inbox,
}: {
    entry: HiderInboxEntry;
    inbox: HiderInboxEntry[];
}) => {
    const draw = cardDraw(entry, inbox);
    if (!draw) {
        return (
            <p className="text-sm font-semibold text-orange-400">
                {t("hider.drawLate")}
            </p>
        );
    }
    const { times, ...cards } = draw;
    return (
        <p className="flex items-center gap-2 text-base font-semibold">
            <LayersIcon className="size-5 shrink-0 text-violet-300" />
            {times > 1
                ? cards.draw === 1
                    ? t("hider.drawOneRepeat", { times })
                    : t("hider.drawRepeat", { times, ...cards })
                : cards.draw === 1
                  ? t("hider.drawOne")
                  : t("hider.draw", cards)}
        </p>
    );
};

/** Shares the answer (WhatsApp and co.) and marks the question as answered. */
const sendAnswer = async (entry: HiderInboxEntry, answer: SentAnswer) => {
    const message = answerMessage(entry, answer);
    const result = await shareMessage(message);
    if (result === "cancelled") return false;
    if (result === "copied") {
        toast.success(t("hider.answerCopied"));
    } else if (result === false) {
        toast.error(t("hider.shareFailed", { message }), { autoClose: false });
    }
    if (isOpen(entry)) markAnswered(entry.key, answer);
    return true;
};

const deleteEntryWithUndo = (key: number) => {
    const inbox = hiderInbox.get();
    const onMap = questions.get();
    removeEntry(key);
    showUndoToast(t("undo.questionDeleted"), () => {
        hiderInbox.set(inbox);
        questions.set(onMap);
    });
};

/** Questions that didn't come as a link: photos, or asked in the chat. */
const AddByHand = ({ onAdded }: { onAdded: (key: number) => void }) => {
    useLanguage();
    const [open, setOpen] = useState(false);

    if (!open) {
        return (
            <Button variant="outline" onClick={() => setOpen(true)}>
                <PlusIcon />
                {t("hider.add")}
            </Button>
        );
    }

    const add = (what: { photo: string } | { kind: ChatQuestionKind }) => {
        onAdded(addEntryByHand(what).key);
        setOpen(false);
    };

    return (
        <div className="flex flex-col gap-3 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{t("hider.add")}</span>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setOpen(false)}
                >
                    {t("common.cancel")}
                </Button>
            </div>
            <p className="text-sm text-muted-foreground">
                {t("hider.addHelp")}
            </p>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("photo.kind")}
            </h4>
            <div className="grid grid-cols-2 gap-2">
                {PHOTO_DECK.map((card) => (
                    <Button
                        key={card.id}
                        variant="outline"
                        className="h-auto min-h-11 whitespace-normal py-2"
                        onClick={() => add({ photo: card.id })}
                    >
                        {tr(card.label)}
                    </Button>
                ))}
            </div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("hider.addChat")}
            </h4>
            <div className="grid grid-cols-2 gap-2">
                {(Object.keys(CHAT_KIND_NAMES) as ChatQuestionKind[]).map(
                    (kind) => (
                        <Button
                            key={kind}
                            variant="outline"
                            className="h-11"
                            onClick={() => add({ kind })}
                        >
                            {CHAT_KIND_NAMES[kind]}
                        </Button>
                    ),
                )}
            </div>
        </div>
    );
};

/** A question in the lists below the current one: tapping shows it. */
const EntryRow = ({
    entry,
    onSelect,
}: {
    entry: HiderInboxEntry;
    onSelect: () => void;
}) => {
    const answer =
        entry.sent ??
        entry.workedOut ??
        (entry.answer ? { value: entry.answer } : undefined);
    return (
        <button
            className="flex items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-accent"
            onClick={onSelect}
        >
            <div className="min-w-0 flex-1">
                <div>
                    <span className="font-semibold">{entryTitle(entry)}</span>
                    {!isOpen(entry) && answer && (
                        <span className="text-violet-300">
                            {" "}
                            · {answerLabel(entry, answer)}
                        </span>
                    )}
                    <span className="text-muted-foreground">
                        {" "}
                        · {clockTime(entry.askedAt)}
                    </span>
                </div>
                {isOpen(entry) && (
                    <AnswerClock
                        start={entry.askedAt}
                        minutes={answerMinutes(entry)}
                    />
                )}
            </div>
        </button>
    );
};

/**
 * The hider's main screen: whether they are in a hiding zone, and the
 * questions of the seekers: open ones with the time left to answer and,
 * for questions sent as links, the answer the app works out from the
 * hider's GPS location; below, the answered ones.
 */
export const HiderScreen = () => {
    const $language = useLanguage();
    const $open = useStore(hiderScreenOpen);
    const $hiderMode = useStore(hiderMode);
    const $inbox = useStore(hiderInbox);
    const $hiderZoneId = useStore(hiderZoneId);
    const $retryTrigger = useStore(retryTrigger);
    const $loadingTasks = useStore(loadingTasks);
    const [fix, setFix] = useState<Fix>({ state: "locating" });
    const [selectedKey, setSelectedKey] = useState<number | null>(null);
    const [result, setResult] = useState<Result | null>(null);
    const [attempt, setAttempt] = useState(0);
    const [sending, setSending] = useState(false);
    const [inBrowser, setInBrowser] = useState(false);

    const stopWaiting = useRef(() => {});

    /** Waits a few seconds for a precise position, like new questions. */
    const locate = async () => {
        setFix({ state: "locating" });
        const search = findPrecisePosition((best) =>
            setFix({ state: "locating", accuracy: best?.accuracy }),
        );
        stopWaiting.current = search.stopWaiting;
        const position = await search.position;
        if (!position) {
            setFix({ state: "failed" });
            return;
        }
        hiderMode.set({ latitude: position.lat, longitude: position.lng });
        setFix({
            state: "gps",
            latitude: position.lat,
            longitude: position.lng,
            accuracy: position.accuracy,
            at: Date.now(),
        });
    };

    // A phone in hider mode opens on this screen; question links open it too
    useEffect(() => {
        if (hiderMode.get() !== false) hiderScreenOpen.set(true);

        const value = new URL(window.location.href).searchParams.get(
            QUESTION_URL_PARAM,
        );
        if (value === null) return;

        // A phone that knew nothing of the game: on an iPhone maybe Safari,
        // while the hider has the app on the home screen
        if (questionLinkRole() === "becomes-hider" && inIphoneBrowser()) {
            setInBrowser(true);
        }
        takeQuestionLink(value).then((key) => {
            // The link is kept until it is in the inbox, in case the page reloads
            removeUrlParam(QUESTION_URL_PARAM);
            if (key !== undefined) setSelectedKey(key);
        });
    }, []);

    // Find the hider whenever the screen opens: they may have moved
    useEffect(() => {
        if ($open && hiderMode.get() !== false) locate();
    }, [$open, $hiderMode === false]);

    const openEntries = $inbox.filter(isOpen);
    // The question tapped last, else the one waiting longest
    const entry =
        $inbox.find((x) => x.key === selectedKey) ?? openEntries[0] ?? null;
    // The app works out answers to open questions from links
    const workingOut = entry?.question && isOpen(entry) ? entry : null;

    const location =
        $hiderMode !== false && (fix.state === "gps" || fix.state === "marker")
            ? $hiderMode
            : null;

    useEffect(() => {
        if (!$open || !workingOut?.question || !location) return;

        const key = workingOut.key;
        let cancelled = false;
        setResult({ key, state: "working" });
        workOutAnswer(workingOut.question, location)
            .then((answer) => {
                if (cancelled) return;
                setResult({ key, state: "done", answer });
                // The answer, not its text: the list shows it in the phone's language
                hiderInbox.set(
                    hiderInbox.get().map((x) =>
                        x.key === key
                            ? {
                                  ...x,
                                  answer: undefined,
                                  workedOut: {
                                      value: answer.value,
                                      location: answer.location,
                                  },
                              }
                            : x,
                    ),
                );
            })
            .catch((error) => {
                if (cancelled) return;
                console.log(error);
                setResult({
                    key,
                    state: "error",
                    message: String(error?.message ?? error),
                });
            });

        return () => {
            cancelled = true;
        };
    }, [
        $open,
        workingOut?.key,
        workingOut?.question,
        location?.latitude,
        location?.longitude,
        attempt,
        $retryTrigger,
        // Station questions are about the station of the chosen zone
        $hiderZoneId,
        // The reason is written in the phone's language
        $language,
    ]);

    // Only the hider's phone has this screen
    if (!$open || $hiderMode === false) return null;

    const close = () => hiderScreenOpen.set(false);

    const fromGps =
        fix.state === "gps" &&
        fix.latitude === $hiderMode.latitude &&
        fix.longitude === $hiderMode.longitude;

    const current = result && workingOut && result.key === workingOut.key;
    const otherOpen = openEntries.filter((x) => x !== entry);
    const answered = $inbox.filter((x) => !isOpen(x) && x !== entry).reverse();

    /** Answers, keeping the question on screen to show it went out. */
    const answer = async (
        sent: SentAnswer,
        how: "share" | "mark" = "share",
    ) => {
        if (!entry) return;
        setSelectedKey(entry.key);
        if (how === "mark") {
            markAnswered(entry.key, sent);
            return;
        }
        setSending(true);
        try {
            await sendAnswer(entry, sent);
        } finally {
            setSending(false);
        }
    };

    const photoCard = entry?.photo ? photoCardFor(entry.photo) : undefined;

    const aboutStation =
        entry?.question?.id === "matching" &&
        STATION_TYPES.includes(entry.question.data.type);

    const openBody = entry && isOpen(entry) && (
        <>
            {aboutStation && !$hiderZoneId && (
                <p className="text-sm text-orange-400">
                    {t("hider.chooseZoneFirst")}
                </p>
            )}
            {entry.question && !location && (
                <p className="text-sm text-muted-foreground">
                    {t("hider.waitingForLocation")}
                </p>
            )}
            {entry.question &&
                location &&
                current &&
                result.state === "working" && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <LoaderCircleIcon className="size-4 animate-spin" />
                        {$loadingTasks[0]?.label ?? t("hider.working")}
                    </div>
                )}
            {entry.question &&
                location &&
                current &&
                result.state === "error" && (
                    <div className="flex flex-col gap-2">
                        <p className="text-sm text-orange-400">
                            {t("hider.failed")}
                        </p>
                        <Button
                            variant="outline"
                            onClick={() => setAttempt(attempt + 1)}
                        >
                            {t("hider.tryAgain")}
                        </Button>
                    </div>
                )}
            {entry.question &&
                location &&
                current &&
                result.state === "done" && (
                    <div className="flex flex-col gap-2">
                        <div className="text-sm text-muted-foreground">
                            {t("hider.yourAnswer")}
                        </div>
                        <div className="text-4xl font-bold font-poppins text-violet-300">
                            {answerLabel(entry, result.answer)}
                        </div>
                        {result.answer.reason && (
                            <p className="text-sm">{result.answer.reason}</p>
                        )}
                        <Button
                            className="h-12 bg-violet-700 text-base font-semibold text-white hover:bg-violet-800"
                            disabled={sending}
                            onClick={() =>
                                answer({
                                    value: result.answer.value,
                                    location: result.answer.location,
                                })
                            }
                        >
                            <SendIcon />
                            {t("hider.send")}
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() =>
                                answer(
                                    {
                                        value: result.answer.value,
                                        location: result.answer.location,
                                    },
                                    "mark",
                                )
                            }
                        >
                            {t("hider.alreadyAnswered")}
                        </Button>
                        <p className="text-sm text-muted-foreground">
                            {t("hider.sendHint")}
                        </p>
                    </div>
                )}
            {entry.photo && (
                <div className="flex flex-col gap-2">
                    <p className="text-sm">{t("hider.photoNote")}</p>
                    <Button
                        className="h-12 bg-violet-700 text-base font-semibold text-white hover:bg-violet-800"
                        onClick={() => answer({ value: "photo" }, "mark")}
                    >
                        <CameraIcon />
                        {t("photo.sent")}
                    </Button>
                    <Button
                        variant="outline"
                        disabled={sending}
                        onClick={() => answer({ value: "no-answer" })}
                    >
                        {t("hider.cantAnswer")}
                    </Button>
                </div>
            )}
            {entry.kind && (
                <div className="flex flex-col gap-2">
                    <p className="text-sm text-muted-foreground">
                        {t("hider.chatNote")}
                    </p>
                    <Button
                        className="h-12 bg-violet-700 text-base font-semibold text-white hover:bg-violet-800"
                        onClick={() => answer({ value: "answered" }, "mark")}
                    >
                        {t("hider.answered")}
                    </Button>
                </div>
            )}
        </>
    );

    const answeredBody = entry && !isOpen(entry) && (
        <div className="flex flex-col gap-2">
            {entry.sent ? (
                <>
                    <div className="text-sm text-muted-foreground">
                        {t("hider.answeredAt", {
                            time: clockTime(entry.answeredAt!),
                        })}
                    </div>
                    <div className="text-3xl font-bold font-poppins text-violet-300">
                        {answerLabel(entry, entry.sent)}
                    </div>
                    <CardDraw entry={entry} inbox={$inbox} />
                    {entry.question && (
                        <p className="text-sm text-muted-foreground">
                            {t("hider.onMap")}
                        </p>
                    )}
                </>
            ) : (
                // Answered before the hider could send answers from here
                (entry.workedOut || entry.answer) && (
                    <div className="text-sm">
                        {t("hider.yourAnswer")}:{" "}
                        <span className="font-semibold text-violet-300">
                            {entry.workedOut
                                ? answerLabel(entry, entry.workedOut)
                                : entry.answer}
                        </span>
                    </div>
                )
            )}
            <div className="grid grid-cols-2 gap-2">
                {entry.sent &&
                (entry.question || entry.sent.value === "no-answer") ? (
                    <Button
                        variant="outline"
                        disabled={sending}
                        onClick={() => answer(entry.sent!)}
                    >
                        <SendIcon />
                        {t("hider.sendAgain")}
                    </Button>
                ) : (
                    <span />
                )}
                <Button
                    variant="outline"
                    onClick={() => reopenEntry(entry.key)}
                >
                    {t("hider.reopen")}
                </Button>
            </div>
        </div>
    );

    const body = (
        <div className="flex flex-col gap-4">
            {inBrowser && (
                <div className="flex flex-col gap-2 rounded-lg border-2 border-orange-500 bg-orange-500/10 p-3">
                    <div className="font-semibold">
                        {t("hider.inBrowserTitle")}
                    </div>
                    <p className="text-sm">
                        {t("hider.inBrowser", { paste: t("hider.paste") })}
                    </p>
                    <Button
                        variant="outline"
                        size="sm"
                        className="self-end"
                        onClick={() => setInBrowser(false)}
                    >
                        {t("common.close")}
                    </Button>
                </div>
            )}
            <GameClockCard />
            <ZoneCheckCard />
            <div className="flex items-center gap-3 rounded-lg border p-3">
                <LocateFixedIcon className="size-5 shrink-0" />
                <div className="min-w-0 flex-1 text-sm">
                    {fix.state === "locating" &&
                        (fix.accuracy === undefined
                            ? t("locating.waiting")
                            : t("locating.accuracy", {
                                  meters: Math.round(fix.accuracy),
                              }))}
                    {fix.state === "failed" && (
                        <span className="text-orange-400">
                            {t("hider.locationFailed")}
                        </span>
                    )}
                    {fix.state === "gps" &&
                        (fromGps
                            ? t("hider.locationGps", {
                                  time: clockTime(fix.at),
                                  meters: Math.round(fix.accuracy),
                              })
                            : t("hider.locationMarker"))}
                    {fix.state === "marker" && t("hider.locationMarker")}
                </div>
                {fix.state === "locating" && fix.accuracy !== undefined ? (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => stopWaiting.current()}
                    >
                        {t("locating.useAnyway")}
                    </Button>
                ) : (
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={fix.state === "locating"}
                        onClick={locate}
                    >
                        {t("hider.update")}
                    </Button>
                )}
            </div>
            {fix.state === "failed" && (
                <Button
                    variant="outline"
                    onClick={() => setFix({ state: "marker" })}
                >
                    {t("hider.useMarker")}
                </Button>
            )}

            {entry ? (
                <div
                    className={cn(
                        "flex flex-col gap-3 rounded-lg border-2 p-4",
                        isOpen(entry) ? "border-violet-500" : "border-border",
                    )}
                >
                    <div>
                        <div className="text-sm text-muted-foreground">
                            {t(
                                entry.byHand
                                    ? "hider.addedAt"
                                    : "hider.questionFromAt",
                                { time: clockTime(entry.askedAt) },
                            )}
                        </div>
                        <div className="flex items-start gap-1">
                            <div className="flex-1 text-xl font-semibold font-poppins">
                                {entryTitle(entry)}
                            </div>
                            <RuleButton ruleId={hiderEntryRuleId(entry)} />
                        </div>
                        {photoCard && (
                            <p className="text-sm text-muted-foreground">
                                {tr(photoCard.hint)}
                            </p>
                        )}
                    </div>
                    {isOpen(entry) && (
                        <AnswerClock
                            start={entry.askedAt}
                            minutes={answerMinutes(entry)}
                            className="text-base"
                        />
                    )}
                    {openBody}
                    {answeredBody}
                    <Button
                        variant="ghost"
                        size="sm"
                        className="self-end text-muted-foreground"
                        onClick={() => {
                            setSelectedKey(null);
                            deleteEntryWithUndo(entry.key);
                        }}
                    >
                        {t("common.delete")}
                    </Button>
                </div>
            ) : (
                <p className="text-muted-foreground">
                    {$inbox.length === 0
                        ? t("hider.noQuestion")
                        : t("hider.noOpen")}
                </p>
            )}

            {otherOpen.length > 0 && (
                <div className="flex flex-col gap-1">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                        {t("hider.open")}
                    </h3>
                    {otherOpen.map((x) => (
                        <EntryRow
                            key={x.key}
                            entry={x}
                            onSelect={() => setSelectedKey(x.key)}
                        />
                    ))}
                </div>
            )}

            <PasteLink onPasted={setSelectedKey} />
            <AddByHand onAdded={setSelectedKey} />

            {answered.length > 0 && (
                <div className="flex flex-col gap-1">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                        {t("sidebar.answered")}
                    </h3>
                    {answered.map((x) => (
                        <EntryRow
                            key={x.key}
                            entry={x}
                            onSelect={() => setSelectedKey(x.key)}
                        />
                    ))}
                </div>
            )}
        </div>
    );

    return (
        <div className="fixed inset-0 z-[1036] flex flex-col bg-background text-foreground">
            <div className="flex items-center gap-3 bg-violet-700 px-4 py-3 text-white shadow-md">
                <VenetianMaskIcon className="size-7 shrink-0" />
                <h1 className="flex-1 text-2xl font-semibold font-poppins">
                    {t("bar.hiderMode")}
                </h1>
                <Button variant="secondary" className="gap-2" onClick={close}>
                    <MapIcon />
                    {t("hider.map")}
                </Button>
                <Button
                    variant="secondary"
                    size="icon"
                    title={t("settings.title")}
                    onClick={() => settingsOpen.set(true)}
                >
                    <SettingsIcon />
                </Button>
            </div>
            <div className="flex-1 overflow-y-auto">
                <div className="mx-auto max-w-lg p-4">{body}</div>
            </div>
        </div>
    );
};
