import { useStore } from "@nanostores/react";
import * as React from "react";
import { toast } from "react-toastify";

import { Button } from "@/components/ui/button";
import {
    type CustomPreset,
    customPresets,
    deleteCustomPreset,
    saveCustomPreset,
    updateCustomPreset,
} from "@/lib/context";
import { questionModified } from "@/lib/context";
import { t, useLanguage } from "@/lib/i18n";

type Props = {
    data: any;
    presetTypeHint: string;
};

const safeClone = (v: any) =>
    typeof structuredClone !== "undefined"
        ? structuredClone(v)
        : JSON.parse(JSON.stringify(v));

const CustomPresets: React.FC<Props> = ({ data, presetTypeHint }) => {
    useLanguage();
    const $presets = useStore(customPresets);

    const presets = $presets.filter((p) =>
        presetTypeHint ? p.type === presetTypeHint : true,
    );

    const handleSave = async () => {
        const name = window.prompt(t("presets.namePrompt"), "");
        if (!name) return;
        const toSave = {
            name,
            type: presetTypeHint || data.type || "custom",
            data: safeClone(data),
        };
        const p = saveCustomPreset(toSave);
        toast.success(t("presets.saved", { name: p.name }));
    };

    const handleLoad = (preset: CustomPreset) => {
        // copy fields from preset.data into the question data so user can deviate
        const src = safeClone(preset.data);
        Object.keys(src).forEach((k) => {
            (data as any)[k] = src[k];
        });
        // ensure nested objects replaced where appropriate (geo etc)
        questionModified();
        toast.info(t("presets.loaded", { name: preset.name }));
    };

    const handleEdit = (preset: CustomPreset) => {
        const newName = window.prompt(t("presets.renamePrompt"), preset.name);
        if (!newName || newName === preset.name) return;
        updateCustomPreset(preset.id, { name: newName });
        toast.success(t("presets.renamed", { name: newName }));
    };

    const handleDelete = (preset: CustomPreset) => {
        if (!window.confirm(t("presets.deleteConfirm", { name: preset.name })))
            return;
        deleteCustomPreset(preset.id);
        toast.info(t("presets.deleted", { name: preset.name }));
    };

    const handleShare = async (preset: CustomPreset) => {
        const payload = {
            name: preset.name,
            type: preset.type,
            data: preset.data,
        };
        try {
            await navigator.clipboard.writeText(JSON.stringify(payload));
            toast.success(t("presets.copied"));
        } catch {
            toast.error(t("clipboard.copyFailed"));
        }
    };

    const handleApplyFromClipboard = async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (!text) {
                toast.error(t("presets.clipboardEmpty"));
                return;
            }
            const payload = JSON.parse(text);
            if (!payload.data) {
                toast.error(t("presets.notPreset"));
                return;
            }
            const src = safeClone(payload.data);
            Object.keys(src).forEach((k) => {
                (data as any)[k] = src[k];
            });
            questionModified();
            toast.info(
                payload.name
                    ? t("presets.applied", { name: payload.name })
                    : t("presets.appliedFromClipboard"),
            );
        } catch {
            toast.error(t("presets.readFailed"));
        }
    };

    return (
        <div className="p-2">
            <div className="flex flex-col sm:flex-row gap-2 [&>*]:w-[50%]">
                <Button onClick={handleSave}>{t("presets.save")}</Button>
                <Button variant="ghost" onClick={handleApplyFromClipboard}>
                    {t("presets.fromClipboard")}
                </Button>
            </div>

            {presets.length === 0 ? (
                <div className="mt-2 text-sm text-muted-foreground">
                    {t("presets.none")}
                </div>
            ) : (
                <div className="mt-3 space-y-2 max-h-56 overflow-y-auto">
                    {presets.map((p) => (
                        <div
                            key={p.id}
                            className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 rounded border p-2"
                        >
                            <div className="flex-1 w-full">
                                <div className="font-semibold">{p.name}</div>
                                <div className="text-xs text-muted-foreground">
                                    {new Date(p.createdAt).toLocaleString()}
                                </div>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                                <Button size="sm" onClick={() => handleLoad(p)}>
                                    {t("presets.load")}
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleEdit(p)}
                                >
                                    {t("presets.rename")}
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleShare(p)}
                                >
                                    {t("presets.share")}
                                </Button>
                                <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => handleDelete(p)}
                                >
                                    {t("common.delete")}
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default CustomPresets;
