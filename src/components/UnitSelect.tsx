import { t, useLanguage } from "@/lib/i18n";
import type { Units } from "@/maps/schema";

import { Select } from "./ui/select";

export const UnitSelect = ({
    unit,
    onChange,
    disabled,
}: {
    unit: Units;
    onChange: (unit: Units) => void;
    disabled?: boolean;
}) => {
    useLanguage();
    return (
        <Select
            trigger={t("card.unit")}
            options={{
                kilometers: t("card.kilometers"),
                meters: t("card.meters"),
            }}
            disabled={disabled}
            value={unit}
            onValueChange={onChange}
        />
    );
};
