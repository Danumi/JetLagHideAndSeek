import { toast } from "react-toastify";

import { photoQuestions, questions } from "@/lib/context";
import { t } from "@/lib/i18n";
import type { Questions } from "@/maps/schema";
import { keepOnlyZones } from "@/maps/zones";

/** Shows a toast with one button for a few seconds. */
export const showActionToast = (
    message: string,
    label: string,
    onAction: () => void,
    autoClose = 4000,
) => {
    toast.info(
        ({ closeToast }) => (
            <div className="flex items-center justify-between gap-3">
                <span>{message}</span>
                <button
                    className="shrink-0 rounded-md bg-blue-600 px-3 py-1 font-semibold text-white"
                    onClick={() => {
                        onAction();
                        closeToast();
                    }}
                >
                    {label}
                </button>
            </div>
        ),
        { autoClose, closeOnClick: false },
    );
};

/** Shows a toast with an undo button for a few seconds. */
export const showUndoToast = (message: string, onUndo: () => void) =>
    showActionToast(message, t("undo.button"), onUndo);

export const deleteQuestionWithUndo = (questionKey: number) => {
    const current = questions.get();
    const index = current.findIndex((q) => q.key === questionKey);
    if (index === -1) return;

    const removed = current[index];
    questions.set(current.filter((q) => q.key !== questionKey));

    showUndoToast(t("undo.questionDeleted"), () => {
        const now = questions.get();
        if (now.some((q) => q.key === removed.key)) return;

        const restored = [...now];
        restored.splice(Math.min(index, restored.length), 0, removed);
        questions.set(restored);
    });
};

export const deletePhotoWithUndo = (key: number) => {
    const current = photoQuestions.get();
    const removed = current.find((photo) => photo.key === key);
    if (!removed) return;

    photoQuestions.set(current.filter((photo) => photo.key !== key));

    showUndoToast(t("undo.questionDeleted"), () => {
        const now = photoQuestions.get();
        if (now.some((photo) => photo.key === key)) return;
        photoQuestions.set([...now, removed]);
    });
};

/** Keeps the ones added in the meantime, after the restored ones. */
const restore = <T extends { key: number }>(removed: T[], now: T[]) => {
    const restoredKeys = new Set(removed.map((x) => x.key));
    return [...removed, ...now.filter((x) => !restoredKeys.has(x.key))];
};

export const deleteAllQuestionsWithUndo = () => {
    const removed: Questions = questions.get();
    const removedPhotos = photoQuestions.get();
    const count = removed.length + removedPhotos.length;
    if (count === 0) return;

    questions.set([]);
    photoQuestions.set([]);

    showUndoToast(
        count === 1
            ? t("undo.questionDeleted")
            : t("undo.questionsDeleted", { count }),
        () => {
            questions.set(restore(removed, questions.get()));
            photoQuestions.set(restore(removedPhotos, photoQuestions.get()));
        },
    );
};

/** "Only this zone" and "Keep only these": rules out every other zone left. */
export const keepOnlyZonesWithUndo = (ids: string[], name?: string) => {
    const { ruledOut, undo } = keepOnlyZones(ids);
    showUndoToast(
        ids.length === 1 && name
            ? t("undo.onlyLeft", { name, ruledOut })
            : t("undo.kept", { count: ids.length, ruledOut }),
        undo,
    );
};
