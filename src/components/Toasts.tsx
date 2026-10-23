import { useEffect } from "react";
import { ToastContainer } from "react-toastify";

import { enableToastSwipe } from "@/lib/toastSwipe";

/**
 * The status messages. Swiping them away is our own (`toastSwipe.ts`):
 * react-toastify's needs a swipe across 80 % of the message, on a phone
 * nearly the whole screen.
 */
export const Toasts = () => {
    useEffect(() => enableToastSwipe(), []);
    return <ToastContainer draggable={false} />;
};
