import { useStore } from "@nanostores/react";
import { divIcon, type DragEndEvent } from "leaflet";
import { MousePointerClickIcon } from "lucide-react";
import { computed } from "nanostores";
import { useEffect, useMemo, useState } from "react";
import { Fragment } from "react/jsx-runtime";
import { Marker } from "react-leaflet";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
    hiderMode,
    myPosition,
    pickingLocation,
    questionModified,
    questions,
    triggerLocalRefresh,
} from "@/lib/context";
import { pickOnMap, placePickedPoint } from "@/lib/gps";
import { t, useLanguage } from "@/lib/i18n";
import { isLogged, isPending } from "@/maps/answers";
import { ICON_COLORS } from "@/maps/api";
import type { Question } from "@/maps/schema";

import { QuestionLogRow } from "./cards/answer";
import {
    MatchingQuestionComponent,
    MeasuringQuestionComponent,
    RadiusQuestionComponent,
    TentacleQuestionComponent,
    ThermometerQuestionComponent,
} from "./QuestionCards";
import { questionIconSvg } from "./questionIcons";

let isDragging = false;

/** The blue dot shows where you are; without it the hider places the H marker. */
const hasMyPosition = computed(myPosition, (position) => position !== null);

/**
 * A pin with the symbol of the question's kind (or a letter). Hollow pins
 * are a thermometer's start, an orange ring means the question still waits
 * for its answer, answered questions get a smaller, paler pin.
 */
const questionPin = (
    symbol: { kind: Question["id"] } | { letter: string },
    color: string,
    { hollow = false, pending = false, answered = false } = {},
) => {
    const size = answered ? 24 : 32;
    const tip = size * 0.375;
    const ink = hollow ? color : "#fff";
    const inner =
        "kind" in symbol
            ? questionIconSvg(symbol.kind, size / 2, ink)
            : symbol.letter;
    return divIcon({
        className: "",
        iconSize: [size, size + tip],
        iconAnchor: [size / 2, size * 0.75 + tip * 1.3],
        html: `<div style="position:relative;width:${size}px;height:${size + tip}px;opacity:${answered ? 0.8 : 1};filter:drop-shadow(0 1px 2px rgba(0,0,0,.5))">
            <div style="position:absolute;left:${(size - tip) / 2}px;top:${size * 0.75}px;width:${tip}px;height:${tip}px;background:${color};transform:rotate(45deg)"></div>
            <div style="position:absolute;left:0;top:0;width:${size}px;height:${size}px;box-sizing:border-box;border-radius:9999px;display:flex;align-items:center;justify-content:center;font:700 15px/1 Poppins,sans-serif;background:${hollow ? "#fff" : color};color:${ink};border:${answered ? 2 : 3}px solid ${pending ? "#f97316" : hollow ? color : "#fff"}">${inner}</div>
        </div>`,
    });
};

const ColoredMarker = ({
    latitude,
    longitude,
    color,
    letter,
    hollow = false,
    draggable = true,
    onChange,
    questionKey,
    sub = "",
}: {
    onChange: (event: DragEndEvent) => void;
    latitude: number;
    longitude: number;
    color: keyof typeof ICON_COLORS;
    /** Shown instead of the question's symbol, like "H" for the hider. */
    letter?: string;
    hollow?: boolean;
    draggable?: boolean;
    questionKey: number;
    sub?: string;
}) => {
    useLanguage();
    const $questions = useStore(questions);
    const $hiderMode = useStore(hiderMode);
    const [open, setOpen] = useState(false);
    const question = $questions.find((q) => q.key === questionKey);
    const pending = !!question && isPending(question);
    const answered = !!question && isLogged(question);
    // "Pick on map" needs the map: the question card here makes way
    useEffect(
        () => pickingLocation.listen((target) => target && setOpen(false)),
        [],
    );
    const kind = question?.id;
    const icon = useMemo(
        () =>
            questionPin(
                kind && !letter ? { kind } : { letter: letter ?? "?" },
                ICON_COLORS[color] ?? ICON_COLORS.blue,
                { hollow, pending, answered },
            ),
        [kind, letter, color, hollow, pending, answered],
    );

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <Marker
                position={[latitude, longitude]}
                icon={icon}
                draggable={draggable}
                eventHandlers={{
                    dragstart: () => {
                        isDragging = true;
                    },
                    dragend: (x) => {
                        onChange(x);
                        setTimeout(() => {
                            isDragging = false;
                        }, 100);
                    },
                    click: () => {
                        if (isDragging) return;
                        // Picking a point: a tap on a pin picks the pin's spot
                        if (
                            placePickedPoint({ lat: latitude, lng: longitude })
                        ) {
                            return;
                        }
                        setOpen(true);
                    },
                }}
            />
            <DialogContent className="!bg-[hsl(var(--sidebar-background))] !text-white">
                {questionKey === -1 && $hiderMode !== false && (
                    <div className="flex flex-col gap-3">
                        <h2 className="text-xl font-semibold">{sub}</h2>
                        <p className="text-sm text-muted-foreground">
                            {t("pin.hiderHelp")}
                        </p>
                        <Button
                            variant="outline"
                            className="h-10"
                            onClick={() => pickOnMap({ questionKey: -1 })}
                        >
                            <MousePointerClickIcon />
                            {t("location.pickOnMap")}
                        </Button>
                    </div>
                )}
                {$questions
                    .filter((q) => q.key === questionKey)
                    .map((q) => {
                        // Answered questions: their line from the question log
                        if (isLogged(q)) {
                            return <QuestionLogRow key={q.key} question={q} />;
                        }
                        switch (q.id) {
                            case "radius":
                                return (
                                    <RadiusQuestionComponent
                                        key={q.key}
                                        data={q.data}
                                        questionKey={q.key}
                                        sub={sub}
                                    />
                                );
                            case "tentacles":
                                return (
                                    <TentacleQuestionComponent
                                        key={q.key}
                                        data={q.data}
                                        questionKey={q.key}
                                        sub={sub}
                                    />
                                );
                            case "thermometer":
                                return (
                                    <ThermometerQuestionComponent
                                        key={q.key}
                                        data={q.data}
                                        questionKey={q.key}
                                        sub={sub}
                                    />
                                );
                            case "matching":
                                return (
                                    <MatchingQuestionComponent
                                        key={q.key}
                                        data={q.data}
                                        questionKey={q.key}
                                        sub={sub}
                                    />
                                );
                            case "measuring":
                                return (
                                    <MeasuringQuestionComponent
                                        key={q.key}
                                        data={q.data}
                                        questionKey={q.key}
                                        sub={sub}
                                    />
                                );
                            default:
                                return null;
                        }
                    })}
            </DialogContent>
        </Dialog>
    );
};

export const DraggableMarkers = () => {
    useStore(triggerLocalRefresh);
    useLanguage();
    const $questions = useStore(questions);
    const $hiderMode = useStore(hiderMode);
    const $hasMyPosition = useStore(hasMyPosition);

    return (
        <Fragment>
            {$hiderMode !== false && !$hasMyPosition && (
                <ColoredMarker
                    color="violet"
                    letter="H"
                    key="hider"
                    sub={t("pin.hidingSpot")}
                    questionKey={-1}
                    latitude={$hiderMode.latitude}
                    longitude={$hiderMode.longitude}
                    onChange={(e) => {
                        $hiderMode.latitude =
                            e.target.getLatLng().lat ?? $hiderMode.latitude;
                        $hiderMode.longitude =
                            e.target.getLatLng().lng ?? $hiderMode.longitude;

                        hiderMode.set({
                            ...$hiderMode,
                        });
                    }}
                />
            )}
            {$questions.map((question) => {
                if (!question.data) return null;
                if (question.data.hidden) return null;
                // Answered questions stay on the map, locked in place
                const draggable = !!question.data.drag;
                if (
                    question.id === "matching" &&
                    question.data.type === "custom-zone"
                )
                    return null;

                switch (question.id) {
                    case "radius":
                    case "tentacles":
                    case "matching":
                    case "measuring":
                        return (
                            <ColoredMarker
                                color={question.data.color}
                                draggable={draggable}
                                key={question.key}
                                questionKey={question.key}
                                latitude={question.data.lat}
                                longitude={question.data.lng}
                                onChange={(e) => {
                                    question.data.lat =
                                        e.target.getLatLng().lat;
                                    question.data.lng =
                                        e.target.getLatLng().lng;
                                    // Placed by hand, not by GPS
                                    question.data.accuracy = undefined;
                                    questionModified();
                                }}
                            />
                        );
                    case "thermometer":
                        return (
                            <Fragment key={question.key}>
                                {/* One color for both ends: they're one question */}
                                <ColoredMarker
                                    color={question.data.colorB}
                                    hollow
                                    draggable={draggable}
                                    key={"a" + question.key.toString()}
                                    questionKey={question.key}
                                    sub={t("location.start")}
                                    latitude={question.data.latA}
                                    longitude={question.data.lngA}
                                    onChange={(e) => {
                                        question.data.latA =
                                            e.target.getLatLng().lat;
                                        question.data.lngA =
                                            e.target.getLatLng().lng;
                                        question.data.accuracyA = undefined;
                                        questionModified();
                                    }}
                                />
                                <ColoredMarker
                                    color={question.data.colorB}
                                    draggable={draggable}
                                    key={"b" + question.key.toString()}
                                    questionKey={question.key}
                                    sub={t("location.end")}
                                    latitude={question.data.latB}
                                    longitude={question.data.lngB}
                                    onChange={(e) => {
                                        question.data.latB =
                                            e.target.getLatLng().lat;
                                        question.data.lngB =
                                            e.target.getLatLng().lng;
                                        question.data.accuracyB = undefined;
                                        questionModified();
                                    }}
                                />
                            </Fragment>
                        );
                    default:
                        return null;
                }
            })}
        </Fragment>
    );
};
