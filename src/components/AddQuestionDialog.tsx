import { useStore } from "@nanostores/react";
import * as turf from "@turf/turf";
import React from "react";
import { toast } from "react-toastify";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { SidebarMenuButton } from "@/components/ui/sidebar-l";
import {
    addQuestion,
    defaultCustomQuestions,
    isLoading,
    showAllQuestionTypes,
} from "@/lib/context";
import { questionLocation } from "@/lib/gps";

export const AddQuestionDialog = ({
    children,
}: {
    children: React.ReactNode;
}) => {
    const $isLoading = useStore(isLoading);
    const $showAllQuestionTypes = useStore(showAllQuestionTypes);
    const [open, setOpen] = React.useState(false);

    const runAddRadius = async () => {
        const center = await questionLocation();
        if (!center) return false;
        addQuestion({
            id: "radius",
            data: { lat: center.lat, lng: center.lng },
        });
        return true;
    };

    const runAddThermometer = async () => {
        const center = await questionLocation();
        if (!center) return false;
        const destination = turf.destination([center.lng, center.lat], 1, 90, {
            units: "kilometers",
        });

        addQuestion({
            id: "thermometer",
            data: {
                latA: center.lat,
                lngA: center.lng,
                latB: destination.geometry.coordinates[1],
                lngB: destination.geometry.coordinates[0],
            },
        });

        return true;
    };

    const runAddTentacles = async () => {
        const center = await questionLocation();
        if (!center) return false;
        addQuestion({
            id: "tentacles",
            data: defaultCustomQuestions.get()
                ? {
                      lat: center.lat,
                      lng: center.lng,
                      locationType: "custom",
                      places: [],
                  }
                : { lat: center.lat, lng: center.lng },
        });
        return true;
    };

    const runAddMatching = async () => {
        const center = await questionLocation();
        if (!center) return false;
        addQuestion({
            id: "matching",
            data: defaultCustomQuestions.get()
                ? { lat: center.lat, lng: center.lng, type: "custom-points" }
                : { lat: center.lat, lng: center.lng },
        });
        return true;
    };

    const runAddMeasuring = async () => {
        const center = await questionLocation();
        if (!center) return false;
        addQuestion({
            id: "measuring",
            data: defaultCustomQuestions.get()
                ? { lat: center.lat, lng: center.lng, type: "custom-measure" }
                : { lat: center.lat, lng: center.lng },
        });
        return true;
    };

    const runPasteQuestion = async () => {
        if (!navigator || !navigator.clipboard) {
            toast.error("Clipboard API not supported in your browser");
            return false;
        }

        try {
            await toast.promise(
                navigator.clipboard.readText().then((text) => {
                    const parsed = JSON.parse(text);
                    const question =
                        parsed &&
                        typeof parsed === "object" &&
                        !Array.isArray(parsed)
                            ? { ...parsed, key: Math.random() }
                            : parsed;

                    return addQuestion(question);
                }),
                {
                    pending: "Reading from clipboard",
                    success: "Question added from clipboard!",
                    error: "No valid question found in clipboard",
                },
                { autoClose: 1000 },
            );

            return true;
        } catch {
            return false;
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent>
                <DialogTitle>Add Question</DialogTitle>
                <DialogDescription>
                    Select which question type you would like to add.
                </DialogDescription>

                <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <SidebarMenuButton
                        onClick={async () => {
                            if (await runAddRadius()) setOpen(false);
                        }}
                        disabled={$isLoading}
                    >
                        Add Radar
                    </SidebarMenuButton>
                    <SidebarMenuButton
                        onClick={async () => {
                            if (await runAddThermometer()) setOpen(false);
                        }}
                        disabled={$isLoading}
                    >
                        Add Thermometer
                    </SidebarMenuButton>
                    {$showAllQuestionTypes && (
                        <SidebarMenuButton
                            onClick={async () => {
                                if (await runAddTentacles()) setOpen(false);
                            }}
                            disabled={$isLoading}
                        >
                            Add Tentacles
                        </SidebarMenuButton>
                    )}
                    <SidebarMenuButton
                        onClick={async () => {
                            if (await runAddMatching()) setOpen(false);
                        }}
                        disabled={$isLoading}
                    >
                        Add Matching
                    </SidebarMenuButton>
                    <SidebarMenuButton
                        onClick={async () => {
                            if (await runAddMeasuring()) setOpen(false);
                        }}
                        disabled={$isLoading}
                    >
                        Add Measuring
                    </SidebarMenuButton>
                    <SidebarMenuButton
                        onClick={async () => {
                            const ok = await runPasteQuestion();
                            if (ok) setOpen(false);
                        }}
                        disabled={$isLoading}
                    >
                        Paste Question
                    </SidebarMenuButton>
                </div>
            </DialogContent>
        </Dialog>
    );
};
