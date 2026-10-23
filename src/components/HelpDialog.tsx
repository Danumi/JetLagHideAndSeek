import { useStore } from "@nanostores/react";
import { ChevronDownIcon, CircleHelpIcon, XIcon } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { guideSeen, helpLanguage, helpOpen } from "@/lib/context";
import { type Language, t, type Text, useLanguage } from "@/lib/i18n";
import { QUESTION_URL_PARAM } from "@/lib/questionLink";
import { cn } from "@/lib/utils";
import {
    GUIDE_SLIDES,
    HELP_TEXTS,
    RULE_SECTIONS,
    type RuleBlock,
    type RuleEntry,
} from "@/maps/rules";

/*
 * The help: a quick guide of five cards and the rules to look things up.
 * It speaks German unless this phone switched it to English (helpLanguage),
 * whatever the app's language; the buttons it names and its pictures are in
 * the app's language, since that's what the player sees.
 */

/** The quick guide opens by itself this long after the app starts. */
const FIRST_GUIDE_DELAY_MS = 1500;

/** The app's buttons the help names, in the app's language. */
const buttonNames = () => ({
    ask: t("ask.button"),
    questions: t("bar.questions"),
    zones: t("bar.zones"),
    newGame: t("newGame.button"),
    seeking: t("role.seeking"),
    hiding: t("role.hiding"),
    sendToHider: t("send.button"),
    sendAnswer: t("hider.send"),
    chooseZone: t("zones.choose"),
    startTimer: t("gameClock.start"),
    startSeeking: t("gameClock.endHiding"),
    pause: t("gameClock.pause"),
    resume: t("gameClock.resume"),
    found: t("gameClock.found"),
    tellHider: t("thermometer.tellHider"),
    pasteLink: t("hider.paste"),
    hiderMoved: t("move.button"),
    moving: t("move.hiderButton"),
    pickOnMap: t("location.pickOnMap"),
});

/** A text of the help with **bold** words and the app's buttons in it. */
const RichText = ({ text, lang }: { text: Text; lang: Language }) => {
    const names: Record<string, string> = buttonNames();
    return (
        <>
            {text[lang].split(/(\*\*[^*]+\*\*|\{\w+\})/).map((piece, index) => {
                const bold = piece.match(/^\*\*([^*]+)\*\*$/)?.[1];
                if (bold) return <strong key={index}>{bold}</strong>;
                const name = piece.match(/^\{(\w+)\}$/)?.[1];
                if (name && name in names) {
                    return (
                        <span
                            key={index}
                            className="whitespace-nowrap font-semibold"
                        >
                            {lang === "de"
                                ? `„${names[name]}“`
                                : `“${names[name]}”`}
                        </span>
                    );
                }
                return piece;
            })}
        </>
    );
};

const Blocks = ({ blocks, lang }: { blocks: RuleBlock[]; lang: Language }) => (
    <>
        {blocks.map((block, index) =>
            "list" in block ? (
                <ul
                    key={index}
                    className="flex list-disc flex-col gap-1.5 pl-5"
                >
                    {block.list.map((item, i) => (
                        <li key={i}>
                            <RichText text={item} lang={lang} />
                        </li>
                    ))}
                </ul>
            ) : (
                <p key={index}>
                    <RichText text={block} lang={lang} />
                </p>
            ),
        )}
    </>
);

const GuideTab = ({
    lang,
    onDone,
    onRules,
}: {
    lang: Language;
    onDone: () => void;
    onRules: () => void;
}) => {
    const appLanguage = useLanguage();
    const [step, setStep] = useState(0);
    const slide = GUIDE_SLIDES[step];
    const last = step === GUIDE_SLIDES.length - 1;

    return (
        <div className="mx-auto flex h-full max-w-md flex-col gap-3 p-4">
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-xl border bg-muted/30">
                <img
                    key={`${slide.id}-${appLanguage}`}
                    src={`${import.meta.env.BASE_URL}/guide/${slide.id}-${appLanguage}.webp`}
                    alt={slide.title[lang]}
                    className="max-h-full max-w-full object-contain"
                />
            </div>
            <div className="text-sm text-muted-foreground">
                {HELP_TEXTS.step[lang]
                    .replace("{n}", String(step + 1))
                    .replace("{count}", String(GUIDE_SLIDES.length))}
            </div>
            <h2 className="text-2xl font-semibold font-poppins">
                {slide.title[lang]}
            </h2>
            <p className="min-h-[6rem] text-base">
                <RichText text={slide.text} lang={lang} />
            </p>
            {last && (
                <p className="text-sm text-muted-foreground">
                    {HELP_TEXTS.rulesHint[lang]}
                </p>
            )}
            <div className="flex justify-center gap-2" aria-hidden>
                {GUIDE_SLIDES.map((other, index) => (
                    <span
                        key={other.id}
                        className={cn(
                            "size-2 rounded-full",
                            index === step ? "bg-foreground" : "bg-muted",
                        )}
                    />
                ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
                {step === 0 ? (
                    <Button variant="outline" onClick={onDone}>
                        {HELP_TEXTS.skip[lang]}
                    </Button>
                ) : (
                    <Button variant="outline" onClick={() => setStep(step - 1)}>
                        {HELP_TEXTS.back[lang]}
                    </Button>
                )}
                {last ? (
                    <Button onClick={onDone}>{HELP_TEXTS.done[lang]}</Button>
                ) : (
                    <Button onClick={() => setStep(step + 1)}>
                        {HELP_TEXTS.next[lang]}
                    </Button>
                )}
            </div>
            {last && (
                <Button variant="ghost" onClick={onRules}>
                    {HELP_TEXTS.readRules[lang]}
                </Button>
            )}
        </div>
    );
};

/** A card or rule to look up: its name, unfolding to the rule. */
const Entry = ({
    entry,
    lang,
    open,
    onToggle,
}: {
    entry: RuleEntry;
    lang: Language;
    open: boolean;
    onToggle: () => void;
}) => (
    <div id={`rule-${entry.id}`} className="scroll-mt-2 rounded-lg border">
        <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left font-semibold"
            aria-expanded={open}
            onClick={onToggle}
        >
            <span className="flex-1">{entry.title[lang]}</span>
            <ChevronDownIcon
                className={cn(
                    "size-4 shrink-0 transition-transform",
                    open && "rotate-180",
                )}
            />
        </button>
        {open && (
            <div className="flex flex-col gap-2 px-3 pb-3 text-sm">
                <Blocks blocks={entry.blocks} lang={lang} />
            </div>
        )}
    </div>
);

const RulesTab = ({
    lang,
    target,
}: {
    lang: Language;
    target: string | undefined;
}) => {
    const [openEntries, setOpenEntries] = useState<Set<string>>(
        () => new Set(target ? [target] : []),
    );
    const jumpTo = (id: string) =>
        document
            .getElementById(`rule-${id}`)
            ?.scrollIntoView({ block: "start" });

    useEffect(() => {
        if (!target) return;
        setOpenEntries((entries) => new Set(entries).add(target));
        // Once the entry has unfolded
        requestAnimationFrame(() => jumpTo(target));
    }, [target]);

    const toggle = (id: string) =>
        setOpenEntries((entries) => {
            const next = new Set(entries);
            if (!next.delete(id)) next.add(id);
            return next;
        });

    return (
        <div className="h-full overflow-y-auto">
            <div className="mx-auto flex max-w-lg flex-col gap-6 p-4 pb-16">
                <nav id="rule-contents" className="scroll-mt-2">
                    <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                        {HELP_TEXTS.contents[lang]}
                    </h2>
                    <ol className="flex flex-col">
                        {RULE_SECTIONS.map((section) => (
                            <li key={section.id}>
                                <button
                                    type="button"
                                    className="w-full py-1.5 text-left text-base underline-offset-4 hover:underline"
                                    onClick={() => jumpTo(section.id)}
                                >
                                    {section.title[lang]}
                                </button>
                            </li>
                        ))}
                    </ol>
                </nav>
                {RULE_SECTIONS.map((section) => (
                    <section
                        key={section.id}
                        id={`rule-${section.id}`}
                        className="flex scroll-mt-2 flex-col gap-3 text-[15px] leading-relaxed"
                    >
                        <h2 className="text-2xl font-semibold font-poppins">
                            {section.title[lang]}
                        </h2>
                        <Blocks blocks={section.blocks} lang={lang} />
                        {section.groups?.map((group, index) => (
                            <div key={index} className="flex flex-col gap-2">
                                {group.title && (
                                    <h3 className="mt-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                                        {group.title[lang]}
                                    </h3>
                                )}
                                {group.entries.map((entry) => (
                                    <Entry
                                        key={entry.id}
                                        entry={entry}
                                        lang={lang}
                                        open={openEntries.has(entry.id)}
                                        onToggle={() => toggle(entry.id)}
                                    />
                                ))}
                            </div>
                        ))}
                        <button
                            type="button"
                            className="self-start text-sm text-muted-foreground underline underline-offset-4"
                            onClick={() => jumpTo("contents")}
                        >
                            {HELP_TEXTS.toTop[lang]}
                        </button>
                    </section>
                ))}
            </div>
        </div>
    );
};

/** The "?" on a question: opens its rule. */
export const RuleButton = ({
    ruleId,
    className,
}: {
    ruleId: string;
    className?: string;
}) => (
    <Button
        variant="ghost"
        size="icon"
        className={cn("size-8 shrink-0 text-muted-foreground", className)}
        title={t("card.rules")}
        aria-label={t("card.rules")}
        onClick={() => helpOpen.set({ tab: "rules", ruleId })}
    >
        <CircleHelpIcon className="!size-5" />
    </Button>
);

const TabButton = ({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: ReactNode;
}) => (
    <button
        type="button"
        className={cn(
            "flex-1 border-b-2 py-2 text-sm font-semibold",
            active
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground",
        )}
        aria-pressed={active}
        onClick={onClick}
    >
        {children}
    </button>
);

export const HelpDialog = () => {
    const $helpOpen = useStore(helpOpen);
    const lang = useStore(helpLanguage);
    useLanguage();

    // The quick guide opens once by itself, but not over a question the
    // hider just received
    useEffect(() => {
        if (guideSeen.get()) return;
        if (new URLSearchParams(location.search).has(QUESTION_URL_PARAM)) {
            return;
        }
        const timer = setTimeout(() => {
            if (!helpOpen.get()) helpOpen.set({ tab: "guide" });
        }, FIRST_GUIDE_DELAY_MS);
        return () => clearTimeout(timer);
    }, []);

    if (!$helpOpen) return null;

    const close = () => {
        guideSeen.set(true);
        helpOpen.set(null);
    };

    return (
        <div
            className="fixed inset-0 z-[1045] flex flex-col bg-background text-foreground"
            lang={lang}
            role="dialog"
            aria-label={HELP_TEXTS.title[lang]}
        >
            <div className="flex items-center gap-2 px-4 pt-3">
                <h1 className="flex-1 text-2xl font-semibold font-poppins">
                    {HELP_TEXTS.title[lang]}
                </h1>
                <div className="flex rounded-md border p-0.5 text-sm">
                    {(
                        [
                            ["de", "Deutsch"],
                            ["en", "English"],
                        ] as [Language, string][]
                    ).map(([value, name]) => (
                        <button
                            key={value}
                            type="button"
                            lang={value}
                            className={cn(
                                "rounded px-2 py-1",
                                lang === value &&
                                    "bg-primary text-primary-foreground",
                            )}
                            aria-pressed={lang === value}
                            onClick={() => helpLanguage.set(value)}
                        >
                            {name}
                        </button>
                    ))}
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    title={HELP_TEXTS.close[lang]}
                    aria-label={HELP_TEXTS.close[lang]}
                    onClick={close}
                >
                    <XIcon />
                </Button>
            </div>
            <div className="flex px-4">
                <TabButton
                    active={$helpOpen.tab === "guide"}
                    onClick={() => helpOpen.set({ tab: "guide" })}
                >
                    {HELP_TEXTS.guide[lang]}
                </TabButton>
                <TabButton
                    active={$helpOpen.tab === "rules"}
                    onClick={() => helpOpen.set({ tab: "rules" })}
                >
                    {HELP_TEXTS.rules[lang]}
                </TabButton>
            </div>
            <div className="min-h-0 flex-1">
                {$helpOpen.tab === "guide" ? (
                    <GuideTab
                        lang={lang}
                        onDone={close}
                        onRules={() => {
                            guideSeen.set(true);
                            helpOpen.set({ tab: "rules" });
                        }}
                    />
                ) : (
                    <RulesTab lang={lang} target={$helpOpen.ruleId} />
                )}
            </div>
        </div>
    );
};
