import { useStore } from "@nanostores/react";
import { useEffect, useState } from "react";

import { mapIdle } from "@/lib/context";
import { retryTrigger } from "@/lib/loading";
import { cn } from "@/lib/utils";
import {
    findNearest,
    hasNearest,
    type Nearest,
    nearestText,
} from "@/maps/nearest";
import type { Question } from "@/maps/schema";

/** Changes whenever what's nearest to the question can change. */
const nearestKey = (question: Question) => {
    const data = question.data as {
        type?: string;
        cat?: { adminLevel?: number };
        lat?: number;
        lng?: number;
    };
    return JSON.stringify([
        question.id,
        data.type,
        data.cat?.adminLevel,
        data.lat,
        data.lng,
    ]);
};

/**
 * What the question is about, seen from where it was asked: null when the
 * app can't tell, "loading" until it knows.
 */
export const useNearest = (
    question: Question,
): Nearest | "loading" | "failed" | null => {
    const $retryTrigger = useStore(retryTrigger);
    const supported = hasNearest(question);
    const key = nearestKey(question);
    const [result, setResult] = useState<{
        key: string;
        nearest: Nearest | "failed" | null;
    } | null>(null);

    useEffect(() => {
        if (!supported) return;
        let cancelled = false;
        // The map loads the question's data first; this then reads it from
        // the cache instead of asking the server a second time
        mapIdle()
            .then(() => findNearest(question))
            .then((nearest) => {
                if (!cancelled) setResult({ key, nearest });
            })
            .catch((error) => {
                console.log(error);
                if (!cancelled) setResult({ key, nearest: "failed" });
            });
        return () => {
            cancelled = true;
        };
    }, [key, supported, $retryTrigger]);

    if (!supported) return null;
    return result?.key === key ? result.nearest : "loading";
};

/** "Nearest museum: Albertina, 350 m" on an open question. */
export const NearestInfo = ({ question }: { question: Question }) => {
    const nearest = useNearest(question);

    if (nearest === null) return null;

    return (
        <div
            className={cn(
                "mx-2 rounded-md border px-3 py-2 text-sm",
                typeof nearest === "string"
                    ? "text-muted-foreground"
                    : "font-semibold",
            )}
        >
            {nearest === "loading"
                ? "Finding what's nearest..."
                : nearest === "failed"
                  ? "Couldn't find what's nearest."
                  : nearestText(nearest)}
        </div>
    );
};

/** The same, as a line of the question log. */
export const NearestNote = ({ question }: { question: Question }) => {
    const nearest = useNearest(question);

    if (nearest === null || typeof nearest === "string") return null;

    return (
        <div className="text-xs text-muted-foreground">
            {nearestText(nearest)}
        </div>
    );
};
