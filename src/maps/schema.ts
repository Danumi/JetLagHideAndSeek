import { z } from "zod";

import { ICON_COLORS } from "./api/constants";

export const NO_GROUP = "NO_GROUP";

export const determineUnionizedStrings = (
    obj: z.ZodUnion<any> | z.ZodLiteral<any> | z.ZodDefault<any>,
): z.ZodLiteral<any>[] => {
    if (obj instanceof z.ZodUnion) {
        return obj.options.flatMap((option: any) =>
            determineUnionizedStrings(option),
        );
    } else if (obj instanceof z.ZodLiteral) {
        return [obj];
    } else if (obj instanceof z.ZodDefault) {
        return determineUnionizedStrings(obj._def.innerType);
    }
    return [];
};

/** Miles stay valid for internal calculations; players only see metric units. */
const unitsSchema = z.union([
    z.literal("miles"),
    z.literal("kilometers"),
    z.literal("meters"),
]);

export const KILOMETERS_PER_MILE = 1.609344;

/** Questions saved in miles by older versions are converted to kilometers. */
const milesToKilometers = (data: unknown) => {
    if (
        data === null ||
        typeof data !== "object" ||
        (data as { unit?: unknown }).unit !== "miles"
    ) {
        return data;
    }

    const { radius } = data as { radius?: unknown };
    return {
        ...data,
        unit: "kilometers",
        radius:
            typeof radius === "number" ? radius * KILOMETERS_PER_MILE : radius,
    };
};

/**
 * A radius that isn't a number above 0 (an emptied number field used to save
 * one) goes back to the start value, so the question still loads.
 */
const repairRadius = (data: unknown) => {
    if (data === null || typeof data !== "object") return data;

    const { radius } = data as { radius?: unknown };
    if (
        radius === undefined ||
        (typeof radius === "number" && Number.isFinite(radius) && radius > 0)
    ) {
        return data;
    }
    return { ...data, radius: undefined, unit: undefined };
};

const iconColorSchema = z.union([
    z.literal("green"),
    z.literal("black"),
    z.literal("blue"),
    z.literal("gold"),
    z.literal("grey"),
    z.literal("orange"),
    z.literal("red"),
    z.literal("violet"),
]);

type IconColor = z.infer<typeof iconColorSchema>;

const randomColorExcluding = (excluded: IconColor[] = []) => {
    const options = (Object.keys(ICON_COLORS) as IconColor[]).filter(
        (color) => !excluded.includes(color),
    );

    return options[Math.floor(Math.random() * options.length)];
};

/**
 * Colors of new questions: not green (zones), grey or black (ruled out), or
 * orange (waiting for the answer).
 */
const randomQuestionColor = () =>
    randomColorExcluding(["green", "grey", "black", "orange"]);

/**
 * New questions wait for the hider's answer ("pending") and don't change the
 * map until then. "no-answer" is for questions the hider can't answer.
 * Questions saved by older versions were answered right away.
 */
const answerStatusSchema = z.enum(["pending", "answered", "no-answer"]);

const answerFields = {
    status: answerStatusSchema.default("answered"),
    /** When the question was asked, in milliseconds since 1970. */
    askedAt: z.number().optional(),
};

const thermometerQuestionSchema = z.object({
    latA: z
        .number()
        .min(-90, "Latitude must not overlap with the poles")
        .max(90, "Latitude must not overlap with the poles"),
    lngA: z
        .number()
        .min(-180, "Longitude must not overlap with the antemeridian")
        .max(180, "Longitude must not overlap with the antemeridian"),
    latB: z
        .number()
        .min(-90, "Latitude must not overlap with the poles")
        .max(90, "Latitude must not overlap with the poles"),
    lngB: z
        .number()
        .min(-180, "Longitude must not overlap with the antemeridian")
        .max(180, "Longitude must not overlap with the antemeridian"),
    warmer: z.boolean().default(true),
    colorA: iconColorSchema.default(randomQuestionColor),
    colorB: iconColorSchema.default(randomQuestionColor),
    /** Note that drag is now synonymous with unlocked */
    drag: z.boolean().default(true),
    collapsed: z.boolean().default(false),
    hidden: z.boolean().default(false),
    ...answerFields,
});

const ordinaryBaseQuestionSchema = z.object({
    lat: z
        .number()
        .min(-90, "Latitude must not overlap with the poles")
        .max(90, "Latitude must not overlap with the poles"),
    lng: z
        .number()
        .min(-180, "Longitude must not overlap with the antemeridian")
        .max(180, "Longitude must not overlap with the antemeridian"),
    /** Note that drag is now synonymous with unlocked */
    drag: z.boolean().default(true),
    color: iconColorSchema.default(randomQuestionColor),
    collapsed: z.boolean().default(false),
    hidden: z.boolean().default(false),
    ...answerFields,
});

const radiusQuestionSchema = ordinaryBaseQuestionSchema.extend({
    radius: z.number().min(0, "You cannot have a negative radius").default(5),
    unit: unitsSchema.default("kilometers"),
    within: z.boolean().default(true),
});

const tentacleLocationsFifteen = z.union([
    z.literal("theme_park").describe("Theme Parks"),
    z.literal("zoo").describe("Zoos"),
    z.literal("aquarium").describe("Aquariums"),
]);

const tentacleLocationsOne = z.union([
    z.literal("museum").describe("Museums"),
    z.literal("hospital").describe("Hospitals"),
    z.literal("cinema").describe("Movie Theaters"),
    z.literal("library").describe("Libraries"),
]);

const apiLocationSchema = z.union([
    z.literal("golf_course"),
    z.literal("consulate"),
    z.literal("park"),
    z.literal("peak"),
    tentacleLocationsFifteen,
    tentacleLocationsOne,
]);

const baseTentacleQuestionSchema = ordinaryBaseQuestionSchema.extend({
    radius: z.number().min(0, "You cannot have a negative radius").default(24),
    unit: unitsSchema.default("kilometers"),
    location: z
        .union([
            z.object({
                type: z.literal("Feature"),
                geometry: z.object({
                    type: z.literal("Point"),
                    coordinates: z.array(z.number()),
                }),
                id: z.union([z.string(), z.number(), z.undefined()]).optional(),
                properties: z.object({
                    name: z.any(),
                }),
            }),
            z.literal(false),
        ])
        .default(false),
});
const tentacleQuestionSpecificSchemaFifteen = baseTentacleQuestionSchema.extend(
    {
        locationType: tentacleLocationsFifteen.default("theme_park"),
        places: z.array(z.any()).optional(),
    },
);

const tentacleQuestionSpecificSchemaOne = baseTentacleQuestionSchema.extend({
    locationType: tentacleLocationsOne,
    places: z.array(z.any()).optional(),
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const encompassingTentacleQuestionSchema = baseTentacleQuestionSchema.extend({
    locationType: apiLocationSchema,
    places: z.array(z.any()).optional(),
});

const customTentacleQuestionSchema = baseTentacleQuestionSchema.extend({
    locationType: z.literal("custom").describe("Custom Locations"),
    places: z.array(
        z.object({
            type: z.literal("Feature"),
            geometry: z.object({
                type: z.literal("Point"),
                coordinates: z.array(z.number()),
            }),
            id: z.union([z.string(), z.number(), z.undefined()]).optional(),
            properties: z.object({
                name: z.any(),
            }),
        }),
    ),
});

export const tentacleQuestionSchema = z.union([
    customTentacleQuestionSchema.describe(NO_GROUP),
    tentacleQuestionSpecificSchemaFifteen.describe("24 km (Typically)"),
    tentacleQuestionSpecificSchemaOne.describe("1.6 km (Typically)"),
]);

const baseMatchingQuestionSchema = ordinaryBaseQuestionSchema.extend({
    same: z.boolean().default(true),
    lengthComparison: z
        .enum(["shorter", "longer", "same", "different"])
        .optional(),
    /** Same train line: the line the seekers are riding (see StationLine.key). */
    lineKey: z.string().optional(),
});

const ordinaryMatchingQuestionSchema = baseMatchingQuestionSchema.extend({
    type: z
        .union([
            z
                .literal("airport")
                .describe("Commercial Airport In Zone Question"),
            z
                .literal("major-city")
                .describe("Major City (1,000,000+ people) In Zone Question"),
            z
                .literal("aquarium-full")
                .describe("Aquarium Question (Small+Medium Games)"),
            z.literal("zoo-full").describe("Zoo Question (Small+Medium Games)"),
            z
                .literal("theme_park-full")
                .describe("Theme Park Question (Small+Medium Games)"),
            z
                .literal("peak-full")
                .describe("Mountain Question (Small+Medium Games)"),
            z
                .literal("museum-full")
                .describe("Museum Question (Small+Medium Games)"),
            z
                .literal("hospital-full")
                .describe("Hospital Question (Small+Medium Games)"),
            z
                .literal("cinema-full")
                .describe("Cinema Question (Small+Medium Games)"),
            z
                .literal("library-full")
                .describe("Library Question (Small+Medium Games)"),
            z
                .literal("golf_course-full")
                .describe("Golf Course Question (Small+Medium Games)"),
            z
                .literal("consulate-full")
                .describe("Foreign Consulate Question (Small+Medium Games)"),
            z
                .literal("park-full")
                .describe("Park Question (Small+Medium Games)"),
            z.literal("street").describe("Street or Path Question"),
            z.literal("landmass").describe("Landmass Question"),
        ])
        .default("airport"),
});

const zoneMatchingQuestionsSchema = baseMatchingQuestionSchema.extend({
    type: z.union([
        z.literal("zone").describe("Zone Question"),
        z
            .literal("letter-zone")
            .describe("Zone Starts With Same Letter Question"),
    ]),
    cat: z
        .object({
            adminLevel: z.union([
                z.literal(2),
                z.literal(3),
                z.literal(4),
                z.literal(5),
                z.literal(6),
                z.literal(7),
                z.literal(8),
                z.literal(9),
                z.literal(10),
            ]),
        })
        .default(() => ({ adminLevel: 3 }) as { adminLevel: 3 }),
});

const homeGameMatchingQuestionsSchema = baseMatchingQuestionSchema.extend({
    type: z.union([
        z.literal("aquarium").describe("Aquarium Question"),
        z.literal("zoo").describe("Zoo Question"),
        z.literal("theme_park").describe("Theme Park Question"),
        z.literal("peak").describe("Mountain Question"),
        z.literal("museum").describe("Museum Question"),
        z.literal("hospital").describe("Hospital Question"),
        z.literal("cinema").describe("Cinema Question"),
        z.literal("library").describe("Library Question"),
        z.literal("golf_course").describe("Golf Course Question"),
        z.literal("consulate").describe("Foreign Consulate Question"),
        z.literal("park").describe("Park Question"),
    ]),
});

const hidingZoneMatchingQuestionsSchema = baseMatchingQuestionSchema.extend({
    type: z.union([
        z
            .literal("same-first-letter-station")
            .describe("Station Starts With Same Letter Question"),
        z
            .literal("same-length-station")
            .describe("Station Has Same Length Question"),
        z
            .literal("same-train-line")
            .describe("Station On Same Train Line Question"),
    ]),
});

const customMatchingQuestionSchema = baseMatchingQuestionSchema.extend({
    type: z.union([
        z.literal("custom-zone").describe("Custom Zone Question"),
        z.literal("custom-points").describe("Custom Points Question"),
    ]),
    geo: z.any(),
});

export const matchingQuestionSchema = z.union([
    zoneMatchingQuestionsSchema.describe(NO_GROUP),
    ordinaryMatchingQuestionSchema.describe(NO_GROUP),
    customMatchingQuestionSchema.describe(NO_GROUP),
    hidingZoneMatchingQuestionsSchema.describe("Hiding Zone Mode"),
    homeGameMatchingQuestionsSchema.describe("Hiding Zone Mode"),
]);

const baseMeasuringQuestionSchema = ordinaryBaseQuestionSchema.extend({
    hiderCloser: z.boolean().default(true),
});

const ordinaryMeasuringQuestionSchema = baseMeasuringQuestionSchema.extend({
    type: z
        .union([
            z.literal("coastline").describe("Coastline Question"),
            z
                .literal("airport")
                .describe("Commercial Airport In Zone Question"),
            z
                .literal("city")
                .describe("Major City (1,000,000+ people) Question"),
            z
                .literal("highspeed-measure-shinkansen")
                .describe("High-Speed Rail Question"),
            z.literal("admin-measure").describe("Admin Border Question"),
            z.literal("water").describe("Body of Water Question"),
            z.literal("sea-level").describe("Sea Level Question"),
            z
                .literal("aquarium-full")
                .describe("Aquarium Question (Small+Medium Games)"),
            z.literal("zoo-full").describe("Zoo Question (Small+Medium Games)"),
            z
                .literal("theme_park-full")
                .describe("Theme Park Question (Small+Medium Games)"),
            z
                .literal("peak-full")
                .describe("Mountain Question (Small+Medium Games)"),
            z
                .literal("museum-full")
                .describe("Museum Question (Small+Medium Games)"),
            z
                .literal("hospital-full")
                .describe("Hospital Question (Small+Medium Games)"),
            z
                .literal("cinema-full")
                .describe("Cinema Question (Small+Medium Games)"),
            z
                .literal("library-full")
                .describe("Library Question (Small+Medium Games)"),
            z
                .literal("golf_course-full")
                .describe("Golf Course Question (Small+Medium Games)"),
            z
                .literal("consulate-full")
                .describe("Foreign Consulate Question (Small+Medium Games)"),
            z
                .literal("park-full")
                .describe("Park Question (Small+Medium Games)"),
        ])
        .default("coastline"),
    cat: z
        .object({
            adminLevel: z.union([
                z.literal(2),
                z.literal(3),
                z.literal(4),
                z.literal(5),
                z.literal(6),
                z.literal(7),
                z.literal(8),
                z.literal(9),
                z.literal(10),
            ]),
            zoneName: z.string().optional(),
        })
        .optional(),
});

const hidingZoneMeasuringQuestionsSchema = baseMeasuringQuestionSchema.extend({
    type: z.union([
        z.literal("mcdonalds").describe("McDonald's Question"),
        z.literal("seven11").describe("7-Eleven Question"),
        z.literal("rail-measure").describe("Train Station Question"),
    ]),
});

const homeGameMeasuringQuestionsSchema = baseMeasuringQuestionSchema.extend({
    type: z.union([
        z.literal("aquarium").describe("Aquarium Question"),
        z.literal("zoo").describe("Zoo Question"),
        z.literal("theme_park").describe("Theme Park Question"),
        z.literal("peak").describe("Mountain Question"),
        z.literal("museum").describe("Museum Question"),
        z.literal("hospital").describe("Hospital Question"),
        z.literal("cinema").describe("Cinema Question"),
        z.literal("library").describe("Library Question"),
        z.literal("golf_course").describe("Golf Course Question"),
        z.literal("consulate").describe("Foreign Consulate Question"),
        z.literal("park").describe("Park Question"),
    ]),
});

const customMeasuringQuestionSchema = baseMeasuringQuestionSchema.extend({
    type: z.literal("custom-measure").describe("Custom Measuring Question"),
    geo: z.any(),
});

export const measuringQuestionSchema = z.union([
    ordinaryMeasuringQuestionSchema.describe(NO_GROUP),
    customMeasuringQuestionSchema.describe(NO_GROUP),
    hidingZoneMeasuringQuestionsSchema.describe("Hiding Zone Mode"),
    homeGameMeasuringQuestionsSchema.describe("Hiding Zone Mode"),
]);

export const questionSchema = z.union([
    z.object({
        id: z.literal("radius"),
        key: z.number().default(Math.random),
        data: z.preprocess(
            (data) => milesToKilometers(repairRadius(data)),
            radiusQuestionSchema,
        ),
    }),
    z.object({
        id: z.literal("thermometer"),
        key: z.number().default(Math.random),
        data: thermometerQuestionSchema,
    }),
    z.object({
        id: z.literal("tentacles"),
        key: z.number().default(Math.random),
        data: z.preprocess(
            (data) => milesToKilometers(repairRadius(data)),
            tentacleQuestionSchema,
        ),
    }),
    z.object({
        id: z.literal("measuring"),
        key: z.number().default(Math.random),
        data: measuringQuestionSchema,
    }),
    z.object({
        id: z.literal("matching"),
        key: z.number().default(Math.random),
        data: matchingQuestionSchema,
    }),
]);

export const questionsSchema = z.array(questionSchema);

export type Units = z.infer<typeof unitsSchema>;
export type AnswerStatus = z.infer<typeof answerStatusSchema>;
export type RadiusQuestion = z.infer<typeof radiusQuestionSchema>;
export type ThermometerQuestion = z.infer<typeof thermometerQuestionSchema>;
export type TentacleQuestion = z.infer<typeof tentacleQuestionSchema>;
export type APILocations = z.infer<typeof apiLocationSchema>;
export type MatchingQuestion = z.infer<typeof matchingQuestionSchema>;
export type HomeGameMatchingQuestions = z.infer<
    typeof homeGameMatchingQuestionsSchema
>;
export type ZoneMatchingQuestions = z.infer<typeof zoneMatchingQuestionsSchema>;
export type CustomMatchingQuestion = z.infer<
    typeof customMatchingQuestionSchema
>;
export type CustomMeasuringQuestion = z.infer<
    typeof customMeasuringQuestionSchema
>;
export type MeasuringQuestion = z.infer<typeof measuringQuestionSchema>;
export type HomeGameMeasuringQuestions = z.infer<
    typeof homeGameMeasuringQuestionsSchema
>;
export type Question = z.infer<typeof questionSchema>;
export type Questions = z.infer<typeof questionsSchema>;
export type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
export type TraditionalTentacleQuestion =
    | z.infer<typeof tentacleQuestionSpecificSchemaFifteen>
    | z.infer<typeof tentacleQuestionSpecificSchemaOne>;
export type EncompassingTentacleQuestionSchema = z.infer<
    typeof encompassingTentacleQuestionSchema
>;
export type CustomTentacleQuestion = z.infer<
    typeof customTentacleQuestionSchema
>;
