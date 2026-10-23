import { isFlick } from "./toastSwipe";

/** A swipe this far (share of the sheet's width) closes it. */
const CLOSE_SHARE = 0.25;
/** Until the finger has moved this far it may still be a tap on a button. */
const TAP_SLOP_PX = 8;
/** The speed of a flick is measured over the end of the swipe. */
const SPEED_WINDOW_MS = 100;
const FLY_OUT_MS = 150;

export interface SheetSwipe {
    /** How far the finger went towards closing, in px. */
    distance: number;
    /** Its speed towards closing at the end of the swipe, in px per ms. */
    speed: number;
    /** The sheet's width. */
    width: number;
}

/** Whether a released swipe closes the sheet: a quarter of its width or a flick. */
export const closesSheet = ({ distance, speed, width }: SheetSwipe) =>
    distance >= width * CLOSE_SHARE || isFlick(distance, speed);

/** Whether the finger is on something scrolled down, so a pull down scrolls. */
const scrolledDown = (target: Element | null, sheet: HTMLElement) => {
    for (let el = target; el && el !== sheet; el = el.parentElement) {
        if (el.scrollTop > 0) return true;
    }
    return false;
};

interface Drag {
    startX: number;
    startY: number;
    /** Towards the side the sheet came from, or down. */
    direction: "side" | "down" | null;
    canPullDown: boolean;
    /** The last positions, to measure the speed of a flick. */
    samples: { time: number; x: number; y: number }[];
}

/**
 * Lets a sheet that slid in from the side be swiped closed with a finger:
 * back towards its side, or down while its list is at the top. It follows
 * the finger and closes after a quarter of its width or a short flick, else
 * it slides back. Returns a function that stops it.
 */
export const enableSheetSwipe = (
    sheet: HTMLElement,
    side: "left" | "right",
    close: () => void,
) => {
    let drag: Drag | null = null;
    /** -1: the sheet closes towards the left. */
    const sign = side === "left" ? -1 : 1;

    const sample = (touch: Touch) => ({
        time: performance.now(),
        x: touch.clientX,
        y: touch.clientY,
    });

    /** The dark overlay over the map, right before the sheet. */
    const overlay = () => {
        const el = sheet.previousElementSibling;
        return el instanceof HTMLElement && el.dataset.state ? el : null;
    };

    /** Moves the sheet, the overlay fades as far as it moved out. */
    const place = (x: number, y: number, ms: number) => {
        sheet.style.transition = ms ? `transform ${ms}ms ease-out` : "none";
        sheet.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        const dim = overlay();
        if (!dim) return;
        const out = Math.max(
            Math.abs(x) / sheet.offsetWidth,
            y / window.innerHeight,
        );
        dim.style.transition = ms ? `opacity ${ms}ms ease-out` : "none";
        dim.style.opacity = `${1 - Math.min(out, 1)}`;
    };

    const slideBack = () => {
        place(0, 0, 200);
        sheet.style.removeProperty("transform");
        overlay()?.style.removeProperty("opacity");
    };

    const onStart = (e: TouchEvent) => {
        // Two fingers (zooming) never close it
        if (e.touches.length !== 1) {
            if (drag?.direction) slideBack();
            drag = null;
            return;
        }
        const target = e.target instanceof Element ? e.target : null;
        if (target?.closest("input, textarea, select, [contenteditable]")) {
            return;
        }
        const touch = e.touches[0];
        drag = {
            startX: touch.clientX,
            startY: touch.clientY,
            direction: null,
            canPullDown: !scrolledDown(target, sheet),
            samples: [sample(touch)],
        };
    };

    const onMove = (e: TouchEvent) => {
        if (!drag || e.touches.length !== 1) return;
        const touch = e.touches[0];
        const dx = touch.clientX - drag.startX;
        const dy = touch.clientY - drag.startY;
        if (!drag.direction) {
            if (Math.hypot(dx, dy) < TAP_SLOP_PX) return;
            if (Math.abs(dx) >= Math.abs(dy)) {
                // Away from the side it came from: not ours
                if (Math.sign(dx) !== sign) {
                    drag = null;
                    return;
                }
                drag.direction = "side";
            } else {
                // Upwards, or down in a scrolled list: it scrolls
                if (dy < 0 || !drag.canPullDown) {
                    drag = null;
                    return;
                }
                drag.direction = "down";
            }
        }
        // The list must not scroll (or the page reload) under the finger
        if (e.cancelable) e.preventDefault();

        const now = sample(touch);
        drag.samples.push(now);
        while (
            drag.samples.length > 2 &&
            now.time - drag.samples[0].time > SPEED_WINDOW_MS
        ) {
            drag.samples.shift();
        }

        // Follows the finger, but never further in than it was
        const x = drag.direction === "side" ? sign * Math.max(sign * dx, 0) : 0;
        const y = drag.direction === "down" ? Math.max(dy, 0) : 0;
        place(x, y, 0);
    };

    const onEnd = (e: TouchEvent) => {
        if (!drag) return;
        const { direction, startX, startY, samples } = drag;
        drag = null;
        if (!direction) return; // A tap: buttons work as usual

        // The finger was on the list, so it must not press a button there
        if (e.cancelable) e.preventDefault();

        const touch = e.changedTouches[0];
        const end = touch ? sample(touch) : samples[samples.length - 1];
        const from =
            samples.find((s) => end.time - s.time <= SPEED_WINDOW_MS) ?? end;
        const ms = end.time - from.time;
        const towards = (a: number, b: number) =>
            direction === "side" ? sign * (a - b) : a - b;
        const swipe = {
            distance:
                direction === "side"
                    ? towards(end.x, startX)
                    : towards(end.y, startY),
            speed:
                ms > 0
                    ? (direction === "side"
                          ? towards(end.x, from.x)
                          : towards(end.y, from.y)) / ms
                    : 0,
            width: sheet.offsetWidth,
        };

        if (e.type !== "touchend" || !closesSheet(swipe)) {
            slideBack();
            return;
        }

        // Slides off the screen, then closes without the usual animation
        // (it would start again from where the sheet was)
        if (direction === "side") {
            place(sign * sheet.offsetWidth, 0, FLY_OUT_MS);
        } else {
            place(0, window.innerHeight, FLY_OUT_MS);
        }
        setTimeout(() => {
            sheet.style.animation = "none";
            close();
        }, FLY_OUT_MS);
    };

    sheet.addEventListener("touchstart", onStart, { passive: true });
    sheet.addEventListener("touchmove", onMove, { passive: false });
    sheet.addEventListener("touchend", onEnd, { passive: false });
    sheet.addEventListener("touchcancel", onEnd, { passive: false });
    return () => {
        sheet.removeEventListener("touchstart", onStart);
        sheet.removeEventListener("touchmove", onMove);
        sheet.removeEventListener("touchend", onEnd);
        sheet.removeEventListener("touchcancel", onEnd);
    };
};
