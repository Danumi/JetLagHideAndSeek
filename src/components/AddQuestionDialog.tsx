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
import { addQuestion, isLoading, showAllQuestionTypes } from "@/lib/context";
import { questionLocation } from "@/lib/gps";
import { t, useLanguage } from "@/lib/i18n";

export const AddQuestionDialog = ({
    children,
}: {
    children: React.ReactNode;
}) => {
    useLanguage();
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
            data: { lat: center.lat, lng: center.lng },
        });
        return true;
    };

    const runAddMatching = async () => {
        const center = await questionLocation();
        if (!center) return false;
        addQuestion({
            id: "matching",
            data: { lat: center.lat, lng: center.lng },
        });
        return true;
    };

    const runAddMeasuring = async () => {
        const center = await questionLocation();
        if (!center) return false;
        addQuestion({
            id: "measuring",
            data: { lat: center.lat, lng: center.lng },
        });
        return true;
    };

    const runPasteQuestion = async () => {
        if (!navigator || !navigator.clipboard) {
            toast.error(t("clipboard.unsupported"));
            return false;
        }

        try {
            await toast.promise(
                navigator.clipboard.readText().then((text) => {
                    const parsed = JSON.parse(text);
                    // Questions shared by older versions are already answered
                    const question =
                        parsed &&
                        typeof parsed === "object" &&
                        !Array.isArray(parsed)
                            ? {
                                  ...parsed,
                                  key: Math.random(),
                                  data: { status: "answered", ...parsed.data },
                              }
                            : parsed;

                    return addQuestion(question);
                }),
                {
                    pending: t("clipboard.reading"),
                    success: t("add.pasted"),
                    error: t("add.pasteFailed"),
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
                <DialogTitle>{t("sidebar.addQuestion")}</DialogTitle>
                <DialogDescription>{t("add.description")}</DialogDescription>

                <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <SidebarMenuButton
                        onClick={async () => {
                            if (await runAddRadius()) setOpen(false);
                        }}
                        disabled={$isLoading}
                    >
                        {t("add.radar")}
                    </SidebarMenuButton>
                    <SidebarMenuButton
                        onClick={async () => {
                            if (await runAddThermometer()) setOpen(false);
                        }}
                        disabled={$isLoading}
                    >
                        {t("add.thermometer")}
                    </SidebarMenuButton>
                    {$showAllQuestionTypes && (
                        <SidebarMenuButton
                            onClick={async () => {
                                if (await runAddTentacles()) setOpen(false);
                            }}
                            disabled={$isLoading}
                        >
                            {t("add.tentacles")}
                        </SidebarMenuButton>
                    )}
                    <SidebarMenuButton
                        onClick={async () => {
                            if (await runAddMatching()) setOpen(false);
                        }}
                        disabled={$isLoading}
                    >
                        {t("add.matching")}
                    </SidebarMenuButton>
                    <SidebarMenuButton
                        onClick={async () => {
                            if (await runAddMeasuring()) setOpen(false);
                        }}
                        disabled={$isLoading}
                    >
                        {t("add.measuring")}
                    </SidebarMenuButton>
                    <SidebarMenuButton
                        onClick={async () => {
                            const ok = await runPasteQuestion();
                            if (ok) setOpen(false);
                        }}
                        disabled={$isLoading}
                    >
                        {t("add.paste")}
                    </SidebarMenuButton>
                </div>
            </DialogContent>
        </Dialog>
    );
};
