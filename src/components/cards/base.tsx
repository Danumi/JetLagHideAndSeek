import { useStore } from "@nanostores/react";
import { EyeIcon, EyeOffIcon, PencilIcon, Trash2Icon } from "lucide-react";

import { ClockNotStarted, SentLine } from "@/components/AnswerClock";
import { RuleButton } from "@/components/HelpDialog";
import { ViewOnly } from "@/components/SeekerMap";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarGroup, SidebarMenu } from "@/components/ui/sidebar-l";
import { deleteQuestionWithUndo } from "@/components/UndoToast";
import {
    isLoading,
    questionModified,
    showAllQuestionTypes,
} from "@/lib/context";
import { type MessageKey, t, useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
    changeSent,
    isPending,
    isSentLocked,
    questionTitle,
} from "@/maps/answers";
import { ANSWER_MINUTES } from "@/maps/deadline";
import { ruleIdFor } from "@/maps/rules";
import type { Question } from "@/maps/schema";

import { AnswerButtons, QuestionBadge, SendToHider } from "./answer";
import { QuestionLocation } from "./location";
import { NearestInfo } from "./nearest";

/** A line on a question card that explains it; a warning needs doing first. */
export const CardNote = ({
    children,
    warning = false,
}: {
    children: React.ReactNode;
    warning?: boolean;
}) => (
    <p
        className={cn(
            "px-1 text-sm",
            warning ? "text-red-400" : "text-muted-foreground",
        )}
    >
        {children}
    </p>
);

/**
 * A sent question stays as the hider has it. To change it, open it here;
 * then it needs sending again.
 */
const ChangeSent = ({ question }: { question: Question }) => {
    useLanguage();
    return (
        <Button
            variant="outline"
            className="h-10"
            onClick={() => {
                changeSent(question);
                questionModified();
            }}
        >
            <PencilIcon />
            {t("send.change")}
        </Button>
    );
};

/** "Delete" on a question card, after asking. */
export const DeleteButton = ({ onDelete }: { onDelete: () => void }) => {
    const $isLoading = useStore(isLoading);
    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button
                    variant="outline"
                    className="h-10"
                    disabled={$isLoading}
                >
                    <Trash2Icon />
                    {t("common.delete")}
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{t("card.deleteTitle")}</AlertDialogTitle>
                    <AlertDialogDescription>
                        {t("card.deleteText")}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={onDelete}
                        className="mb-2 sm:mb-0"
                    >
                        {t("common.delete")}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
};

/**
 * In German, the kinds keep their names from the game; one short line says
 * what they ask.
 */
const KIND_EXPLANATIONS: Partial<Record<Question["id"], MessageKey>> = {
    matching: "kind.matching.question",
    measuring: "kind.measuring.question",
    radius: "kind.radar.question",
    thermometer: "kind.thermometer.question",
};

/**
 * Every open question looks the same, in the order of the game: symbol and
 * name, the settings of its card (`children`), where it was asked and
 * what's nearest, "Send to hider", the answer buttons (pale until sent) and
 * "Delete". Once sent, a line with the time and the answer buttons come
 * first, then the place and "Change and send again".
 */
export const QuestionCard = ({
    question,
    children,
    beforeAnswer,
    className,
    sub,
}: {
    question: Question;
    children?: React.ReactNode;
    /** Shown right above the answer buttons (tentacles: the hider's place). */
    beforeAnswer?: React.ReactNode;
    className?: string;
    /** "Start" or "End" when opened from a thermometer's pin. */
    sub?: string;
}) => {
    const $language = useLanguage();
    const pending = isPending(question);
    const explanation = KIND_EXPLANATIONS[question.id];
    const sent = isSentLocked(question);
    const $showAllQuestionTypes = useStore(showAllQuestionTypes);
    // An open question's pin only: for experts (and to show it again)
    const canHide = !pending || $showAllQuestionTypes || !!question.data.hidden;

    return (
        <>
            <SidebarGroup
                className={cn(
                    "gap-3 border-l-4",
                    pending ? "border-orange-500" : "border-transparent",
                    className,
                )}
                data-question-key={question.key}
            >
                <div className="flex items-center gap-2 px-1">
                    <QuestionBadge question={question} />
                    <div className="min-w-0 flex-1">
                        <h3 className="text-base font-semibold leading-tight">
                            {questionTitle(question)}
                            {sub && (
                                <span className="font-normal text-muted-foreground">
                                    {" "}
                                    · {sub}
                                </span>
                            )}
                        </h3>
                        {$language === "de" && explanation && (
                            <p className="text-xs text-muted-foreground">
                                {t(explanation)}
                            </p>
                        )}
                    </div>
                    <RuleButton ruleId={ruleIdFor(question)} />
                </div>
                {/* Another seeker's phone asks: only shown here */}
                <ViewOnly className="flex flex-col gap-3">
                    {children && <SidebarMenu>{children}</SidebarMenu>}
                    {/* Sent: the time and the answer come first */}
                    {sent && (
                        <>
                            <SentLine
                                sentAt={question.data.sentAt!}
                                minutes={ANSWER_MINUTES}
                                send={<SendToHider question={question} small />}
                            />
                            {beforeAnswer}
                            <AnswerButtons question={question} />
                        </>
                    )}
                    <QuestionLocation question={question} />
                    <NearestInfo question={question} />
                    {/* Not sent yet (or being changed): send first */}
                    {pending && !sent && (
                        <div className="flex flex-col gap-2">
                            {question.data.sentAt !== undefined && (
                                <CardNote>{t("send.changing")}</CardNote>
                            )}
                            <SendToHider question={question} />
                            {question.data.sentAt === undefined && (
                                <ClockNotStarted minutes={ANSWER_MINUTES} />
                            )}
                        </div>
                    )}
                    {!sent && (
                        <>
                            {beforeAnswer}
                            <AnswerButtons question={question} pale={pending} />
                        </>
                    )}
                    <div className="flex flex-col gap-2">
                        {sent && <ChangeSent question={question} />}
                        <div
                            className={cn(
                                "grid gap-2",
                                canHide ? "grid-cols-2" : "grid-cols-1",
                            )}
                        >
                            {canHide && (
                                <Button
                                    variant="outline"
                                    className="h-10"
                                    onClick={() =>
                                        questionModified(
                                            (question.data.hidden =
                                                !question.data.hidden),
                                        )
                                    }
                                >
                                    {question.data.hidden ? (
                                        <EyeIcon />
                                    ) : (
                                        <EyeOffIcon />
                                    )}
                                    {question.data.hidden
                                        ? t("card.showOnMap")
                                        : t("card.hideOnMap")}
                                </Button>
                            )}
                            <DeleteButton
                                onDelete={() =>
                                    deleteQuestionWithUndo(question.key)
                                }
                            />
                        </div>
                    </div>
                </ViewOnly>
            </SidebarGroup>
            <Separator className="h-1" />
        </>
    );
};
