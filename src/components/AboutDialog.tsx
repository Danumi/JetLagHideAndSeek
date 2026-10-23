import type { ReactNode } from "react";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { t, useLanguage } from "@/lib/i18n";

/** One source: what it is for, who it is (linked) and its licence. */
const Credit = ({
    title,
    href,
    name,
    children,
}: {
    title: string;
    href: string;
    name: string;
    children?: ReactNode;
}) => (
    <li className="flex flex-col gap-0.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {title}
        </span>
        <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="font-medium underline underline-offset-2"
        >
            {name}
        </a>
        {children && (
            <span className="text-xs text-muted-foreground">{children}</span>
        )}
    </li>
);

/**
 * Settings → "About": where the map data and tools come from. The map itself
 * shows no credits (Daniel's wish, 2026-10-23).
 */
export const AboutDialog = ({
    open,
    onOpenChange,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) => {
    useLanguage();

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[85svh] w-[calc(100%-2rem)] overflow-y-auto rounded-lg text-foreground">
                <DialogHeader>
                    <DialogTitle className="pr-6">
                        {t("about.title")}
                    </DialogTitle>
                    <DialogDescription>{t("about.intro")}</DialogDescription>
                </DialogHeader>
                <ul className="flex flex-col gap-4 text-sm">
                    <Credit
                        title={t("about.mapData")}
                        href="https://www.openstreetmap.org/copyright"
                        name={`© ${t("credits.osm")}`}
                    >
                        {t("about.osmLicence")}
                    </Credit>
                    <Credit
                        title={t("about.mapImages")}
                        href="https://carto.com/attributions"
                        name="© CARTO"
                    />
                    <Credit
                        title={t("about.calculations")}
                        href="https://www.esri.com"
                        name={t("credits.esri")}
                    />
                    <Credit
                        title={t("about.elevation")}
                        href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md"
                        name={t("about.elevationSource")}
                    >
                        {t("about.elevationAustria")}
                    </Credit>
                    <li className="flex flex-col gap-0.5">
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {t("about.software")}
                        </span>
                        <span>{t("about.softwareText")}</span>
                    </li>
                </ul>
            </DialogContent>
        </Dialog>
    );
};
