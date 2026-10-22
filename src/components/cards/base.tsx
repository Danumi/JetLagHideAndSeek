import { useStore } from "@nanostores/react";
import { EyeIcon, EyeOffIcon, Trash2Icon } from "lucide-react";

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
import { isLoading, questionModified, questions } from "@/lib/context";
import { cn } from "@/lib/utils";
import { isPending, questionTitle } from "@/maps/answers";
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
 * Every open question looks the same: number and name, the settings of its
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
    const $questions = useStore(questions);
    const $isLoading = useStore(isLoading);
    const number = $questions.findIndex((q) => q.key === question.key) + 1;
    const pending = isPending(question);

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
                    <QuestionBadge question={question} number={number} />
                    <h3 className="min-w-0 flex-1 text-base font-semibold leading-tight">
                        {questionTitle(question)}
                        {sub && (
                            <span className="font-normal text-muted-foreground">
                                {" "}
                                · {sub}
                            </span>
                        )}
                    </h3>
                </div>
                {children && <SidebarMenu>{children}</SidebarMenu>}
                <QuestionLocation question={question} number={number} />
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
                                ? "Show on map"
                                : "Hide on map"}
                        </Button>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button
                                    variant="outline"
                                    className="h-10"
                                    disabled={$isLoading}
                                >
                                    <Trash2Icon />
                                    Delete
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>
                                        Delete question?
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                        The question disappears from the map.
                                        You can undo this right afterwards.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>
                                        Cancel
                                    </AlertDialogCancel>
                                    <AlertDialogAction
                                        onClick={() =>
                                            deleteQuestionWithUndo(question.key)
                                        }
                                        className="mb-2 sm:mb-0"
                                    >
                                        Delete
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </div>
            </SidebarGroup>
            <Separator className="h-1" />
        </>
    );
};
