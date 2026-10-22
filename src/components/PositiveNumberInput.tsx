import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

import { Input } from "./ui/input";

/** The number typed, or null unless it is a number above 0 ("2,5" counts). */
export const parsePositiveNumber = (text: string) => {
    const value = parseFloat(text.replace(",", "."));
    return Number.isFinite(value) && value > 0 ? value : null;
};

/**
 * A number field that may be empty or half typed: only numbers above 0 are
 * passed on, so clearing it to type a new value doesn't break the question.
 */
export const PositiveNumberInput = ({
    value,
    onChange,
    className,
    disabled,
}: {
    value: number;
    onChange: (value: number) => void;
    className?: string;
    disabled?: boolean;
}) => {
    const [text, setText] = useState(String(value));

    // Follow changes made elsewhere, e.g. with the distance buttons
    useEffect(() => {
        if (parsePositiveNumber(text) !== value) setText(String(value));
    }, [value]);

    return (
        <Input
            type="text"
            inputMode="decimal"
            className={cn("rounded-md p-2 w-16", className)}
            value={text}
            disabled={disabled}
            onChange={(e) => {
                setText(e.target.value);
                const parsed = parsePositiveNumber(e.target.value);
                if (parsed !== null && parsed !== value) onChange(parsed);
            }}
            // Left empty or invalid: show the value that still counts
            onBlur={() => {
                if (parsePositiveNumber(text) === null) setText(String(value));
            }}
        />
    );
};
