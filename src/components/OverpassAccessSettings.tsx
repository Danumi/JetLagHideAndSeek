import { useStore } from "@nanostores/react";
import { useMemo, useState } from "react";
import { toast } from "react-toastify";
import { renderSVG } from "uqr";

import { overpassCustomHost } from "@/lib/context";
import { t, useLanguage } from "@/lib/i18n";
import {
    interpreterUrl,
    overpassSetupLink,
    readOverpassSetup,
    saveOverpassSetup,
} from "@/lib/overpassAccess";
import { shareOrFallback } from "@/lib/utils";

import { Button } from "./ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

/** Tells the player that a setup link saved the access on this phone. */
export const toastOverpassSaved = () => toast.success(t("overpass.saved"));

/** A pasted setup link puts its access in the field, not the whole link. */
const setOrTakeSetup = (text: string) => {
    const host = readOverpassSetup(text);
    if (!host) {
        overpassCustomHost.set(text);
        return;
    }
    saveOverpassSetup(host);
    toastOverpassSaved();
};

/** The link and QR code that hand this phone's access to other phones. */
const SetupDialog = ({
    open,
    onOpenChange,
    host,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    host: string;
}) => {
    const link = overpassSetupLink(host, window.location.href);
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
 * Where the map data comes from: the Overpass access with its key, and the
 * setup link for the other phones.
 */
export const OverpassAccessSettings = () => {
    useLanguage();
    const $access = useStore(overpassCustomHost);
    const [setupOpen, setSetupOpen] = useState(false);
    const host = interpreterUrl($access);

    return (
        <>
            <Label htmlFor="overpass-access">
                {t("settings.overpassAccess")}
            </Label>
            <Input
                id="overpass-access"
                type="url"
                value={$access}
                onChange={(e) => setOrTakeSetup(e.target.value)}
                placeholder="https://api.overpass.ch/v1/…/interpreter"
            />
            {!host && (
                <p className="text-xs font-semibold text-red-600">
                    {t("settings.overpassMissing")}
                </p>
            )}
            <p className="text-xs text-muted-foreground">
                {t("settings.overpassHint")}
            </p>
            <Button
                variant="outline"
                disabled={!host}
                onClick={() => setSetupOpen(true)}
            >
                {t("settings.setupOthers")}
            </Button>
            {/* Only rendered when open: the dialog needs the browser's document */}
            {setupOpen && (
                <SetupDialog
                    open={setupOpen}
                    onOpenChange={setSetupOpen}
                    host={host}
                />
            )}
        </>
    );
};
