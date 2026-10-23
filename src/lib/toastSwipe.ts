import { toast } from "react-toastify";

/** A swipe sideways this far (share of the message's width) removes it. */
const SWIPE_SHARE = 0.25;
/** A swipe upwards this far (share of the message's height) removes it. */
const SWIPE_UP_SHARE = 0.5;
/** A short flick removes it too: at least this fast (px per ms)... */
const FLICK_SPEED = 0.3;
/** ...and at least this far. */
const FLICK_MIN_PX = 20;
/** Until the finger has moved this far it may still be a tap on a button. */
const TAP_SLOP_PX = 8;
/** The speed of a flick is measured over the end of the swipe. */
const SPEED_WINDOW_MS = 100;
const FLY_OUT_MS = 150;

export type SwipeAway = "left" | "right" | "up";

export interface Swipe {
    axis: "x" | "y";
    /** Distance from where the finger went down, in px. */
    dx: number;
    dy: number;
    /** Speed at the end of the swipe, in px per ms. */
    vx: number;
    vy: number;
    width: number;
    height: number;
}

export const isFlick = (distance: number, speed: number) =>
    distance >= FLICK_MIN_PX && speed >= FLICK_SPEED;

/** Where a released swipe sends the message, or null if it goes back. */
export const swipeAway = ({
    axis,
    dx,
    dy,
    vx,
    vy,
    width,
    height,
}: Swipe): SwipeAway | null => {
    if (axis === "x") {
        const flick = isFlick(Math.abs(dx), Math.sign(dx) * vx);
        if (Math.abs(dx) >= width * SWIPE_SHARE || flick) {
            return dx < 0 ? "left" : "right";
        }
        return null;
    }
    // Downwards never removes it
    return -dy >= height * SWIPE_UP_SHARE || isFlick(-dy, -vy) ? "up" : null;
};

interface Drag {
    toast: HTMLElement;
    pointerId: number;
    startX: number;
    startY: number;
    axis: "x" | "y" | null;
    /** The last positions, to measure the speed of a flick. */
    samples: { time: number; x: number; y: number }[];
}

/**
 * Lets status messages be swiped away sideways or upwards, like notifications
 * on a phone, also with a short flick. Only messages with an X, so not
 * "Getting your location" while it waits. Returns a function that stops it.
 */
export const enableToastSwipe = () => {
    let drag: Drag | null = null;
    let ignoreClicksUntil = 0;

    const sample = (e: PointerEvent) => ({
        time: performance.now(),
        x: e.clientX,
        y: e.clientY,
    });

    const onDown = (e: PointerEvent) => {
        // A new first finger also replaces a swipe whose end got lost
        if (!e.isPrimary || e.button !== 0) return;
        const target = e.target instanceof Element ? e.target : null;
        const el = target?.closest<HTMLElement>(".Toastify__toast");
        if (!el?.id || !el.querySelector(".Toastify__close-button")) return;
        drag = {
            toast: el,
            pointerId: e.pointerId,
            startX: e.clientX,
            startY: e.clientY,
            axis: null,
            samples: [sample(e)],
        };
    };

    const onMove = (e: PointerEvent) => {
        if (!drag || e.pointerId !== drag.pointerId) return;
        const dx = e.clientX - drag.startX;
        const dy = e.clientY - drag.startY;
        const el = drag.toast;
        if (!drag.axis) {
            if (Math.hypot(dx, dy) < TAP_SLOP_PX) return;
            drag.axis = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
            el.style.transition = "none";
            toast.pause({ id: el.id });
        }
        const now = sample(e);
        drag.samples.push(now);
        while (
            drag.samples.length > 2 &&
            now.time - drag.samples[0].time > SPEED_WINDOW_MS
        ) {
            drag.samples.shift();
        }

        // Follows the finger and fades towards the point where it goes away
        const progress =
            drag.axis === "x"
                ? Math.abs(dx) / (el.offsetWidth * SWIPE_SHARE)
                : -dy / (el.offsetHeight * SWIPE_UP_SHARE);
        const x = drag.axis === "x" ? dx : 0;
        const y = drag.axis === "y" ? (dy < 0 ? dy : dy / 4) : 0;
        el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        el.style.opacity = `${1 - 0.6 * Math.min(Math.max(progress, 0), 1)}`;
    };

    const onEnd = (e: PointerEvent) => {
        if (!drag || e.pointerId !== drag.pointerId) return;
        const { toast: el, axis, startX, startY, samples } = drag;
        drag = null;
        if (!axis) return; // A tap: the buttons and the X work as usual

        // The finger was on the message, so it must not press a button there
        ignoreClicksUntil = performance.now() + 500;

        const end = sample(e);
        const from =
            samples.find((s) => end.time - s.time <= SPEED_WINDOW_MS) ?? end;
        const ms = end.time - from.time;
        const dy = end.y - startY;
        const away =
            e.type === "pointerup" && el.isConnected
                ? swipeAway({
                      axis,
                      dx: end.x - startX,
                      dy,
                      vx: ms > 0 ? (end.x - from.x) / ms : 0,
                      vy: ms > 0 ? (end.y - from.y) / ms : 0,
                      width: el.offsetWidth,
                      height: el.offsetHeight,
                  })
                : null;

        if (!away) {
            el.style.transition = "transform 0.2s, opacity 0.2s";
            el.style.removeProperty("transform");
            el.style.removeProperty("opacity");
            // After react-toastify, which pauses a message lifted inside it
            setTimeout(() => toast.play({ id: el.id }));
            return;
        }

        // Flies off the screen, then goes without the usual animation
        const x =
            away === "left"
                ? -window.innerWidth
                : away === "right"
                  ? window.innerWidth
                  : 0;
        const y =
            away === "up" ? dy - el.getBoundingClientRect().bottom - 20 : 0;
        el.style.transition = `transform ${FLY_OUT_MS}ms ease-out, opacity ${FLY_OUT_MS}ms ease-out`;
        el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        el.style.opacity = "0";
        setTimeout(() => {
            el.style.visibility = "hidden";
            toast.dismiss(el.id);
        }, FLY_OUT_MS);
    };

    const onClick = (e: MouseEvent) => {
        if (performance.now() > ignoreClicksUntil) return;
        const target = e.target instanceof Element ? e.target : null;
        if (!target?.closest(".Toastify__toast")) return;
        e.stopPropagation();
        e.preventDefault();
    };

    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("pointermove", onMove, true);
    document.addEventListener("pointerup", onEnd, true);
    document.addEventListener("pointercancel", onEnd, true);
    document.addEventListener("click", onClick, true);
    return () => {
        document.removeEventListener("pointerdown", onDown, true);
        document.removeEventListener("pointermove", onMove, true);
        document.removeEventListener("pointerup", onEnd, true);
        document.removeEventListener("pointercancel", onEnd, true);
        document.removeEventListener("click", onClick, true);
    };
};
