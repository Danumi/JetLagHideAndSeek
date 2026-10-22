import { persistentAtom } from "@nanostores/persistent";
import { useStore } from "@nanostores/react";
import { createElement, Fragment, type ReactNode } from "react";

import { type MessageKey, messages } from "@/lib/messages";

export type { MessageKey };

/*
 * The app speaks English, or German if this phone chose so in the settings.
 * Every text the app writes itself comes in both languages: in messages.ts,
 * or as a `Text` right where it is used (the cards of the deck). Names from
 * OpenStreetMap stay as on the signs, and Bundesland, Gemeindebezirk and
 * Katastralgemeinde are called so in both languages. A question sent to the
 * hider carries the question, not its text, so each phone shows it in its
 * own language.
 */

export type Language = "de" | "en";

/** A text in both languages. */
export type Text = Record<Language, string>;

/**
 * English unless this phone switched to German. A new key, since the old one
 * ("language") holds German on every phone that opened the app while German
 * was the default, chosen or not.
 */
export const language = persistentAtom<Language>("appLanguage", "en", {
    encode: (value) => value,
    decode: (value) => (value === "de" ? "de" : "en"),
});

if (typeof document !== "undefined") {
    language.subscribe((value) => {
        document.documentElement.lang = value;
    });
}

/**
 * Components that show texts call this, so they show the new language right
 * after the switch in the settings.
 */
export const useLanguage = () => useStore(language);

type Params = Record<string, string | number>;

const fill = (template: string, params?: Params) =>
    params
        ? template.replace(/\{(\w+)\}/g, (match, name: string) =>
              name in params ? String(params[name]) : match,
          )
        : template;

/** A text of the app in this phone's language, with its {placeholders} filled in. */
export const t = (key: MessageKey, params?: Params) =>
    fill(messages[key][language.get()], params);

/** A text given in both languages, like a card of the deck. */
export const tr = (text: Text, params?: Params) =>
    fill(text[language.get()], params);

/** Whether there is a text for a key that is put together, like `nearest.title.${what}`. */
export const hasMessage = (key: string): key is MessageKey => key in messages;

/**
 * The text for a key kept as data, like the kinds of questions in schema.ts
 * (`.describe("type.park")`); anything else stays as it is.
 */
export const labelOf = (key: string | undefined) =>
    key !== undefined && hasMessage(key) ? t(key) : (key ?? "");

/**
 * The same, with parts that are more than text: a bold number in "37 of 99
 * zones left", say.
 */
export const tx = (key: MessageKey, parts: Record<string, ReactNode>) =>
    messages[key][language.get()].split(/(\{\w+\})/).map((piece, index) => {
        const name = piece.match(/^\{(\w+)\}$/)?.[1];
        return createElement(
            Fragment,
            { key: index },
            name && name in parts ? parts[name] : piece,
        );
    });

/** "1.2" in English, "1,2" in German. */
export const formatNumber = (
    value: number,
    maximumFractionDigits = 1,
    minimumFractionDigits = 0,
) =>
    value.toLocaleString(language.get() === "de" ? "de-AT" : "en-GB", {
        maximumFractionDigits,
        minimumFractionDigits,
        useGrouping: false,
    });
