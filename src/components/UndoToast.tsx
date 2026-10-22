import { toast } from "react-toastify";

import { questions } from "@/lib/context";
import type { Questions } from "@/maps/schema";
import { keepOnlyZones } from "@/maps/zones";

/** Shows a toast with one button for a few seconds. */
export const showActionToast = (
    message: string,
    label: string,
    onAction: () => void,
    autoClose = 8000,
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
    showActionToast(message, "Undo", onUndo);

export const deleteQuestionWithUndo = (questionKey: number) => {
    const current = questions.get();
    const index = current.findIndex((q) => q.key === questionKey);
    if (index === -1) return;

    const removed = current[index];
    questions.set(current.filter((q) => q.key !== questionKey));

    showUndoToast("Question deleted", () => {
        const now = questions.get();
        if (now.some((q) => q.key === removed.key)) return;

        const restored = [...now];
        restored.splice(Math.min(index, restored.length), 0, removed);
        questions.set(restored);
    });
};

export const deleteAllQuestionsWithUndo = () => {
    const removed: Questions = questions.get();
    if (removed.length === 0) return;

    questions.set([]);

    showUndoToast(
        removed.length === 1
            ? "1 question deleted"
            : `${removed.length} questions deleted`,
        () => {
            // Keep questions added in the meantime, after the restored ones
            const now = questions.get();
            const restoredKeys = new Set(removed.map((q) => q.key));
            questions.set([
                ...removed,
                ...now.filter((q) => !restoredKeys.has(q.key)),
            ]);
        },
    );
};

/** "Only this zone" and "Keep only these": rules out every other zone left. */
export const keepOnlyZonesWithUndo = (ids: string[], name?: string) => {
    const { ruledOut, undo } = keepOnlyZones(ids);
    showUndoToast(
        `${ids.length === 1 && name ? `Only ${name} is left` : `${ids.length} zones kept`}, ${ruledOut} ruled out`,
        undo,
    );
};
