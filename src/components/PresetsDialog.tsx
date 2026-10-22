import * as React from "react";

import CustomPresets from "@/components/CustomPresets";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { t, useLanguage } from "@/lib/i18n";

type Props = {
    data: any;
    presetTypeHint: string;
    triggerLabel?: string;
};

const PresetsDialog: React.FC<Props> = ({
    data,
    presetTypeHint,
    triggerLabel,
}) => {
    useLanguage();
    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button size="sm" className="w-full">
                    {triggerLabel ?? t("presets.use")}
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogTitle>{t("presets.title")}</DialogTitle>
                <CustomPresets data={data} presetTypeHint={presetTypeHint} />
            </DialogContent>
        </Dialog>
    );
};

export default PresetsDialog;
