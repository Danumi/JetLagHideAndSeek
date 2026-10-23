import { TimerIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { t, useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { countdown, countdownText } from "@/maps/deadline";

/** Now, once a second. */
export const useNow = () => {
    const [now, setNow] = useState(Date.now);
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);
    return now;
};

/**
 * Until when the hider has to answer, counting down: "Answer due 14:37 ·
 * 3:07 left". Red in the last minutes and once it's late.
 */
export const AnswerClock = ({
    start,
    minutes,
    className,
}: {
    /** When the seekers asked. */
    start: number;
    minutes: number;
    className?: string;
}) => {
    useLanguage();
    const now = useNow();
    const clock = countdown(start, minutes, now);

    return (
        <div
            className={cn(
                "flex items-center gap-1.5 text-sm tabular-nums",
                clock.urgent
                    ? "font-semibold text-red-400"
                    : "text-muted-foreground",
                className,
            )}
        >
            <TimerIcon className="size-4 shrink-0" />
            {countdownText(clock)}
        </div>
    );
};

/** Before the question is sent: the clock starts with "Send to hider". */
export const ClockNotStarted = ({ minutes }: { minutes: number }) => {
    useLanguage();
    return (
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <TimerIcon className="size-4 shrink-0" />
            {t("clock.notSent", { minutes })}
        </div>
    );
};
