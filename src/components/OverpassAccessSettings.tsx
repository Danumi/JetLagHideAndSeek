import { useStore } from "@nanostores/react";
import { useMemo, useState } from "react";
import { toast } from "react-toastify";
import { renderSVG } from "uqr";

import { overpassCustomHost, overpassFallbackHost } from "@/lib/context";
import { t, useLanguage } from "@/lib/i18n";
import {
    overpassBaseUrls,
    overpassSetupLink,
    readOverpassSetup,
    saveOverpassSetup,
} from "@/lib/overpassAccess";
import { shareOrFallback } from "@/lib/utils";

import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

/** Tells the player that a setup link saved its accesses on this phone. */
export const toastOverpassSaved = (count: number) =>
    toast.success(
        count > 1 ? t("overpass.savedWithFallback") : t("overpass.saved"),
    );

/** A pasted setup link fills both fields instead of landing in one. */
const setOrTakeSetup = (text: string, set: (value: string) => void) => {
    const hosts = readOverpassSetup(text);
    if (!hosts) {
        set(text);
        return;
    }
    saveOverpassSetup(hosts);
    toastOverpassSaved(hosts.length);
};

/** The link and QR code that hand this phone's access to other phones. */
const SetupDialog = ({
    open,
    onOpenChange,
    hosts,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    hosts: string[];
}) => {
    const [fallbackFirst, setFallbackFirst] = useState(false);
    const ordered =
        fallbackFirst && hosts.length > 1 ? [...hosts].reverse() : hosts;
    const link = overpassSetupLink(ordered, window.location.href);
    const qrCode = useMemo(
        () => renderSVG(link, { border: 4, ecc: "L" }),
        [link],
    );

    const share = async (forceClipboard: boolean) => {
        const result = await shareOrFallback(link, forceClipboard);
        if (result === "clipboard") toast.success(t("overpass.linkCopied"));
        else if (result === false)
            toast.error(t("game.copyByHand", { link }), { autoClose: false });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[100dvh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{t("settings.setupOthers")}</DialogTitle>
                    <DialogDescription>
                        {t("overpass.setupText")}
                    </DialogDescription>
                </DialogHeader>
                <div
                    className="mx-auto w-full max-w-[260px] [&>svg]:block [&>svg]:w-full"
                    role="img"
                    aria-label={link}
                    dangerouslySetInnerHTML={{ __html: qrCode }}
                />
                {hosts.length > 1 && (
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between gap-2">
                            <Label htmlFor="overpass-fallback-first">
                                {t("overpass.fallbackFirst")}
                            </Label>
                            <Checkbox
                                id="overpass-fallback-first"
                                checked={fallbackFirst}
                                onCheckedChange={(v) => setFallbackFirst(!!v)}
                            />
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {t("overpass.fallbackFirstHint")}
                        </p>
                    </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                    <Button onClick={() => share(false)}>
                        {t("overpass.shareLink")}
                    </Button>
                    <Button variant="outline" onClick={() => share(true)}>
                        {t("overpass.copyLink")}
                    </Button>
                </div>
                <p className="text-sm font-semibold text-red-600">
                    {t("overpass.warning")}
                </p>
                <p className="text-xs text-muted-foreground">
                    {t("overpass.iphoneHint")}
                </p>
            </DialogContent>
        </Dialog>
    );
};

/**
 * Where the map data comes from: the Overpass access with its key, a
 * fallback, and the setup link for the other phones.
 */
export const OverpassAccessSettings = () => {
    useLanguage();
    const $main = useStore(overpassCustomHost);
    const $fallback = useStore(overpassFallbackHost);
    const [setupOpen, setSetupOpen] = useState(false);
    const hosts = overpassBaseUrls($main, $fallback);

    return (
        <>
            <Label htmlFor="overpass-access">
                {t("settings.overpassAccess")}
            </Label>
            <Input
                id="overpass-access"
                type="url"
                value={$main}
                onChange={(e) =>
                    setOrTakeSetup(e.target.value, overpassCustomHost.set)
                }
                placeholder="https://api.overpass.ch/v1/…/interpreter"
            />
            <Label htmlFor="overpass-fallback">
                {t("settings.overpassFallback")}
            </Label>
            <Input
                id="overpass-fallback"
                type="url"
                value={$fallback}
                onChange={(e) =>
                    setOrTakeSetup(e.target.value, overpassFallbackHost.set)
                }
                placeholder="https://api.overpass.ch/v1/…/interpreter"
            />
            {hosts.length === 0 && (
                <p className="text-xs font-semibold text-red-600">
                    {t("settings.overpassMissing")}
                </p>
            )}
            <p className="text-xs text-muted-foreground">
                {t("settings.overpassHint")}
            </p>
            <Button
                variant="outline"
                disabled={hosts.length === 0}
                onClick={() => setSetupOpen(true)}
            >
                {t("settings.setupOthers")}
            </Button>
            {/* Only rendered when open: the dialog needs the browser's document */}
            {setupOpen && (
                <SetupDialog
                    open={setupOpen}
                    onOpenChange={setSetupOpen}
                    hosts={hosts}
                />
            )}
        </>
    );
};
