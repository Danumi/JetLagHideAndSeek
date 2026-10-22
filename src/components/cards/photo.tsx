import { CameraIcon } from "lucide-react";

import { AnswerClock } from "@/components/AnswerClock";
import { RuleButton } from "@/components/HelpDialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarGroup } from "@/components/ui/sidebar-l";
import { deletePhotoWithUndo } from "@/components/UndoToast";
import { type PhotoQuestion, updatePhotoQuestion } from "@/lib/context";
import { scrollToQuestion } from "@/lib/gps";
import { t, tr, useLanguage } from "@/lib/i18n";
import { photoLink } from "@/lib/questionLink";
import { cn } from "@/lib/utils";
import { ICON_COLORS } from "@/maps/api";
import { clockStart, clockTime, PHOTO_ANSWER_MINUTES } from "@/maps/deadline";
import { photoCardFor } from "@/maps/deck";
import { photoTitle } from "@/maps/hiderLog";
import { photoRuleId } from "@/maps/rules";

import { SendLinkButton } from "./answer";
import { CardNote, DeleteButton } from "./base";

/*
 * Photo questions: the photo comes in the chat, the app can't check it. The
 * question only goes into the log, with the time the hider has to answer.
 */

/** A camera; an orange ring while the photo hasn't come. */
const PhotoBadge = ({ pending }: { pending: boolean }) => (
    <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-white"
        style={{
            background: ICON_COLORS.blue,
            borderColor: pending ? "#f97316" : "#ffffff",
        }}
    >
        <CameraIcon className="h-4 w-4" strokeWidth={2.5} />
    </span>
);

/** A photo question waiting for the photo, like the other question cards. */
export const PhotoQuestionCard = ({ photo }: { photo: PhotoQuestion }) => {
    useLanguage();
    const card = photoCardFor(photo.photo);
    const asked = clockStart(photo);

    return (
        <>
            <SidebarGroup
                className="gap-3 border-l-4 border-orange-500"
                data-question-key={photo.key}
            >
                <div className="flex items-center gap-2 px-1">
                    <PhotoBadge pending />
                    <h3 className="min-w-0 flex-1 text-base font-semibold leading-tight">
                        {photoTitle(photo.photo)}
                    </h3>
                    <RuleButton ruleId={photoRuleId(photo.photo)} />
                </div>
                {card && <CardNote>{tr(card.hint)}</CardNote>}
                <CardNote>{t("photo.notOnMap")}</CardNote>
                <div className="flex flex-col gap-2">
                    <span className="text-sm font-semibold text-orange-400">
                        {t("photo.waiting")}
                    </span>
                    {asked !== undefined && (
                        <AnswerClock
                            start={asked}
                            minutes={PHOTO_ANSWER_MINUTES}
                        />
                    )}
                    <Button
                        variant="outline"
                        className="h-14 text-lg font-semibold"
                        onClick={() =>
                            updatePhotoQuestion(photo.key, {
                                status: "answered",
                            })
                        }
                    >
                        {t("photo.received")}
                    </Button>
                    <Button
                        variant="outline"
                        className="h-10 font-semibold"
                        onClick={() =>
                            updatePhotoQuestion(photo.key, {
                                status: "no-answer",
                            })
                        }
                    >
                        {t("answer.none")}
                    </Button>
                </div>
                <div className="flex flex-col gap-2">
                    <SendLinkButton
                        makeLink={() => {
                            const sentAt = photo.sentAt ?? Date.now();
                            if (photo.sentAt === undefined) {
                                updatePhotoQuestion(photo.key, { sentAt });
                            }
                            return photoLink({ ...photo, sentAt });
                        }}
                        message={(link) =>
                            t("photo.sendMessage", {
                                title: photoTitle(photo.photo),
                                link,
                            })
                        }
                    />
                    <DeleteButton
                        onDelete={() => deletePhotoWithUndo(photo.key)}
                    />
                </div>
            </SidebarGroup>
            <Separator className="h-1" />
        </>
    );
};

/** An answered photo question as one line of the question log. */
export const PhotoLogRow = ({ photo }: { photo: PhotoQuestion }) => {
    useLanguage();
    return (
        <>
            <div
                className="flex items-start gap-2 px-3 py-2"
                data-question-key={photo.key}
            >
                <PhotoBadge pending={false} />
                <div className="min-w-0 flex-1 text-sm leading-snug">
                    <span className="font-semibold">
                        {photoTitle(photo.photo)}
                    </span>
                    {" · "}
                    <span
                        className={cn(
                            "font-semibold",
                            photo.status === "no-answer"
                                ? "text-muted-foreground"
                                : "text-sky-300",
                        )}
                    >
                        {photo.status === "no-answer"
                            ? t("answer.none")
                            : t("photo.received")}
                    </span>
                    <span className="text-muted-foreground">
                        {" "}
                        · {clockTime(photo.askedAt)}
                    </span>
                </div>
                <Button
                    variant="outline"
                    className="h-10"
                    onClick={() => {
                        updatePhotoQuestion(photo.key, { status: "pending" });
                        // Its card moves up to the open questions
                        setTimeout(() => scrollToQuestion(photo.key), 100);
                    }}
                >
                    {t("answer.edit")}
                </Button>
            </div>
            <Separator className="h-1" />
        </>
    );
};
