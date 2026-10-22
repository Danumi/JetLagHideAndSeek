import { useStore } from "@nanostores/react";
import { EyeIcon, EyeOffIcon, Trash2Icon } from "lucide-react";

import { RuleButton } from "@/components/HelpDialog";
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
import { isLoading, questionModified } from "@/lib/context";
import { type MessageKey, t, useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { isPending, questionTitle } from "@/maps/answers";
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
 * Every open question looks the same: symbol and name, the settings of its
 * card (`children`), where it was asked and what's nearest, the answer
 * buttons, then "Send to hider", "Hide on map" and "Delete".
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
                {children && <SidebarMenu>{children}</SidebarMenu>}
                <QuestionLocation question={question} />
                <NearestInfo question={question} />
                {beforeAnswer}
                <AnswerButtons question={question} />
                <div className="flex flex-col gap-2">
                    {pending && <SendToHider question={question} />}
                    <div className="grid grid-cols-2 gap-2">
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
                        <DeleteButton
                            onDelete={() =>
                                deleteQuestionWithUndo(question.key)
                            }
                        />
                    </div>
                </div>
            </SidebarGroup>
            <Separator className="h-1" />
        </>
    );
};
