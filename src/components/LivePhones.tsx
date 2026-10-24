import { useStore } from "@nanostores/react";
import * as turf from "@turf/turf";
import { UsersIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { CircleMarker, Pane, Tooltip } from "react-leaflet";
import { toast } from "react-toastify";
import { renderSVG } from "uqr";

import { hiderMode } from "@/lib/context";
import { t, useLanguage } from "@/lib/i18n";
import {
    createLiveGame,
    databaseAddress,
    joinLiveGame,
    keepScreenOn,
    leaveLiveGame,
    liveAddress,
    type LiveGame,
    liveGame,
    liveLink,
    liveStatus,
    readLiveLink,
    SEEKER_POSITION_MAX_AGE_MS,
    type SeekerPosition,
    seekerPositions,
} from "@/lib/live";
import { cn, shareOrFallback } from "@/lib/utils";
import { formatKilometers } from "@/maps/answers";

import { useNow } from "./AnswerClock";
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

/*
 * Connected phones: "Connect phones" in the settings shows the game's QR
 * code and link, the database's address sits under "Advanced". The hider
 * sees the seekers as red dots on the map and how far away they are.
 */

/** Tells the player what opening a connection link did. */
export const toastLiveJoined = (result: "joined" | "already" | null) => {
    if (result === "joined") toast.success(t("live.joined"));
    if (result === "already") toast.info(t("live.alreadyJoined"));
};

/** "just now", "3 min ago". */
const agoText = (sentAt: number, now: number) => {
    const minutes = Math.floor((now - sentAt) / 60_000);
    return minutes < 1 ? t("live.justNow") : t("live.minutesAgo", { minutes });
};

/** The seekers' positions that are from this round, newest first. */
const useSeekerPositions = (now: number) => {
    const $positions = useStore(seekerPositions);
    return Object.values($positions)
        .filter(({ sentAt }) => now - sentAt < SEEKER_POSITION_MAX_AGE_MS)
        .sort((a, b) => b.sentAt - a.sentAt);
};

/** Under "Advanced": the database the phones connect through. */
export const LiveAddressSettings = () => {
    useLanguage();
    const $address = useStore(liveAddress);

    return (
        <>
            <Label htmlFor="live-address">{t("settings.liveAddress")}</Label>
            <Input
                id="live-address"
                type="url"
                value={$address}
                onChange={(e) => {
                    // A pasted connection link joins its game
                    const game = readLiveLink(e.target.value);
                    if (game)
                        toastLiveJoined(
                            joinLiveGame(game) ? "joined" : "already",
                        );
                    else liveAddress.set(e.target.value);
                }}
                placeholder="https://….firebasedatabase.app"
            />
            <p className="text-xs text-muted-foreground">
                {t("settings.liveHint")}
            </p>
        </>
    );
};

const StatusLine = () => {
    const $status = useStore(liveStatus);
    if ($status === "off") return null;
    return (
        <p
            className={cn(
                "text-sm font-semibold",
                $status === "connected" && "text-green-600",
                $status === "failed" && "text-red-600",
            )}
        >
            {$status === "connected"
                ? t("live.connected")
                : $status === "failed"
                  ? t("live.failed")
                  : t("live.connecting")}
        </p>
    );
};

/** The QR code and link that connect another phone to the game. */
const GameCode = ({ game }: { game: LiveGame }) => {
    const link = liveLink(game, window.location.href);
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
        <>
            <p className="text-sm text-muted-foreground">{t("live.scan")}</p>
            <div
                className="mx-auto w-full max-w-[240px] [&>svg]:block [&>svg]:w-full"
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
                {t("live.warning")}
            </p>
            <p className="text-xs text-muted-foreground">
                {t("live.iphoneHint")}
            </p>
        </>
    );
};

const LiveDialog = ({
    open,
    onOpenChange,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) => {
    const $game = useStore(liveGame);
    const $address = useStore(liveAddress);
    const $keepScreenOn = useStore(keepScreenOn);
    const address = databaseAddress($address);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[100dvh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{t("live.button")}</DialogTitle>
                    <DialogDescription>{t("live.what")}</DialogDescription>
                </DialogHeader>
                {!$game && !address && (
                    <p className="text-sm">{t("live.noAddress")}</p>
                )}
                {!$game && address && (
                    <Button className="h-11" onClick={() => createLiveGame()}>
                        <UsersIcon />
                        {t("live.start")}
                    </Button>
                )}
                {$game && (
                    <>
                        <StatusLine />
                        <GameCode game={$game} />
                        <div className="flex items-center justify-between gap-2">
                            <Label
                                htmlFor="live-keep-screen-on"
                                className="font-semibold"
                            >
                                {t("live.keepScreenOn")}
                            </Label>
                            <Checkbox
                                id="live-keep-screen-on"
                                checked={$keepScreenOn}
                                onCheckedChange={(v) => keepScreenOn.set(!!v)}
                            />
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {t("live.keepScreenOnHint")}
                        </p>
                        <Button
                            variant="ghost"
                            className="self-end text-muted-foreground"
                            onClick={() => {
                                if (
                                    window.confirm(t("live.disconnectConfirm"))
                                ) {
                                    leaveLiveGame();
                                }
                            }}
                        >
                            {t("live.disconnect")}
                        </Button>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
};

/** "Connect phones" in the settings, "Phones connected" once they are. */
export const LivePhonesButton = ({ className }: { className?: string }) => {
    useLanguage();
    const $game = useStore(liveGame);
    const [open, setOpen] = useState(false);

    return (
        <>
            <Button
                variant="outline"
                className={cn(
                    $game && "border-green-600 text-green-600",
                    className,
                )}
                onClick={() => setOpen(true)}
            >
                <UsersIcon />
                {$game ? t("live.buttonOn") : t("live.button")}
            </Button>
            {/* Only rendered when open: the dialog needs the browser's document */}
            {open && <LiveDialog open={open} onOpenChange={setOpen} />}
        </>
    );
};

const SeekerMark = ({
    position,
    now,
}: {
    position: SeekerPosition;
    now: number;
}) => (
    <CircleMarker
        center={[position.lat, position.lng]}
        radius={8}
        pathOptions={{
            color: "#ffffff",
            weight: 3,
            fillColor: "#e11d48",
            fillOpacity: 1,
        }}
        interactive={false}
        pane="seekers"
    >
        <Tooltip
            pane="tooltipPane"
            permanent
            direction="top"
            offset={[0, -8]}
            className="!font-semibold"
        >
            {`${t("live.seekers")} · ${agoText(position.sentAt, now)}`}
        </Tooltip>
    </CircleMarker>
);

/** The hider's map: where the seekers' phones were, as red dots. */
export const SeekerMarks = () => {
    useLanguage();
    const hider = useStore(hiderMode) !== false;
    const now = useNow();
    const positions = useSeekerPositions(now);
    if (!hider) return null;

    return (
        // Above the grey area and the zones, below the blue dot
        <Pane name="seekers" style={{ zIndex: 445, pointerEvents: "none" }}>
            {positions.map((position) => (
                <SeekerMark
                    key={`${position.lat},${position.lng},${position.sentAt}`}
                    position={position}
                    now={now}
                />
            ))}
        </Pane>
    );
};

/** On the hider screen: how far away the nearest seeker is, and since when. */
export const SeekersFromHider = () => {
    useLanguage();
    const $hiderMode = useStore(hiderMode);
    const now = useNow();
    const positions = useSeekerPositions(now);
    if ($hiderMode === false || positions.length === 0) return null;

    const hider = [$hiderMode.longitude, $hiderMode.latitude];
    const nearest = positions
        .map((position) => ({
            position,
            kilometers: turf.distance(hider, [position.lng, position.lat], {
                units: "kilometers",
            }),
        }))
        .sort((a, b) => a.kilometers - b.kilometers)[0];

    return (
        <div className="flex items-center gap-3 rounded-lg border p-3 text-sm">
            <UsersIcon className="size-5 shrink-0 text-rose-600" />
            {t("live.seekersFrom", {
                distance: formatKilometers(nearest.kilometers),
                ago: agoText(nearest.position.sentAt, now),
            })}
        </div>
    );
};
