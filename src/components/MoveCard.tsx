import { TruckIcon } from "lucide-react";
import { useState } from "react";

import { t, useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { hiderMoved, hiderMoves, undoMove } from "@/maps/move";

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
} from "./ui/alert-dialog";
import { Button } from "./ui/button";
import { showUndoToast } from "./UndoToast";

/**
 * The Move card: seekers tap "Hider moved" in the question list, the hider
 * "I'm moving" on the hider screen. Asks first, then can be undone.
 */
export const MoveButton = ({
    hider = false,
    className,
}: {
    /** On the hider's phone. */
    hider?: boolean;
    className?: string;
}) => {
    useLanguage();
    const [open, setOpen] = useState(false);
    const names = {
        ruleOut: t("zones.ruleOut"),
        resume: t("gameClock.resume"),
    };

    const move = () => {
        const before = hider ? hiderMoves() : hiderMoved();
        showUndoToast(hider ? t("move.hiderDone") : t("move.done"), () =>
            undoMove(before),
        );
    };

    return (
        <AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogTrigger asChild>
                <Button variant="outline" className={cn("gap-2", className)}>
                    <TruckIcon />
                    {hider ? t("move.hiderButton") : t("move.button")}
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>
                        {hider ? t("move.hiderTitle") : t("move.title")}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        {hider
                            ? t("move.hiderText", names)
                            : t("move.text", names)}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                    <AlertDialogAction onClick={move}>
                        {hider ? t("move.hiderConfirm") : t("move.confirm")}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
};
