import { describe, expect, test } from "vitest";

import {
    photoLink,
    QUESTION_URL_PARAM,
    questionInText,
    questionLink,
    readQuestionLink,
} from "@/lib/questionLink";
import { questionSchema } from "@/maps/schema";

const APP_URL = "https://danumi.github.io/JetLagHideAndSeek/?hzc=old#top";

const linkValue = (link: string) =>
    new URL(link).searchParams.get(QUESTION_URL_PARAM)!;

describe("question links for the hider", () => {
    test("carry the question, not the seekers' state", async () => {
        const question = questionSchema.parse({
            id: "radius",
            key: 0.42,
            data: {
                lat: 48.2,
                lng: 16.37,
                radius: 2,
                unit: "kilometers",
                status: "pending",
                askedAt: 1_700_000_000_000,
                hidden: true,
                collapsed: true,
                color: "red",
            },
        });

        const link = await questionLink(question, 3, APP_URL);
        expect(
            link.startsWith("https://danumi.github.io/JetLagHideAndSeek/?ask="),
        ).toBe(true);
        expect(link).not.toContain("hzc");

        const received = await readQuestionLink(linkValue(link));
        expect(received.number).toBe(3);
        expect(received.question!.id).toBe("radius");
        expect(received.question!.key).toBe(0.42);
        expect(received.question!.data).toMatchObject({
            lat: 48.2,
            lng: 16.37,
            radius: 2,
            unit: "kilometers",
            askedAt: 1_700_000_000_000,
            status: "pending",
            drag: true,
            hidden: false,
            collapsed: false,
        });
    });

    test("keep what the question is about", async () => {
        const question = questionSchema.parse({
            id: "matching",
            key: 0.7,
            data: {
                lat: 48.19,
                lng: 16.36,
                type: "zone",
                cat: { adminLevel: 9 },
                status: "pending",
            },
        });

        const received = await readQuestionLink(
            linkValue(await questionLink(question, undefined, APP_URL)),
        );
        expect(received.number).toBeUndefined();
        expect(received.question!.data).toMatchObject({
            type: "zone",
            cat: { adminLevel: 9 },
            status: "pending",
        });
    });

    test("carry when the seekers sent the question, for the hider's clock", async () => {
        const question = questionSchema.parse({
            id: "radius",
            key: 0.5,
            data: {
                lat: 48.2,
                lng: 16.37,
                radius: 1,
                unit: "kilometers",
                status: "pending",
                askedAt: 1_700_000_000_000,
                sentAt: 1_700_000_030_000,
            },
        });

        const received = await readQuestionLink(
            linkValue(await questionLink(question, undefined, APP_URL)),
        );
        expect(received.question!.data).toMatchObject({
            askedAt: 1_700_000_000_000,
            sentAt: 1_700_000_030_000,
        });
    });

    test("carry photo questions", async () => {
        const link = await photoLink(
            {
                key: 0.9,
                photo: "tree",
                askedAt: 1_700_000_000_000,
                sentAt: 1_700_000_010_000,
            },
            APP_URL,
        );

        const received = await readQuestionLink(linkValue(link));
        expect(received.question).toBeUndefined();
        expect(received.photo).toEqual({
            key: 0.9,
            photo: "tree",
            askedAt: 1_700_000_000_000,
            sentAt: 1_700_000_010_000,
        });
    });

    test("reject broken links", async () => {
        await expect(readQuestionLink("not-a-question")).rejects.toThrow();
    });

    test("are found in a message pasted from the chat", async () => {
        const link = await photoLink(
            { key: 0.9, photo: "tree", askedAt: 1_700_000_000_000 },
            APP_URL,
        );

        expect(questionInText(link)).toBe(linkValue(link));
        expect(questionInText(`  ${link}\n`)).toBe(linkValue(link));
        expect(
            questionInText(`Radar 2 km: see https://example.com/ and ${link}`),
        ).toBe(linkValue(link));
        expect(
            questionInText("https://danumi.github.io/JetLagHideAndSeek/"),
        ).toBeNull();
        expect(questionInText("Radar 2 km")).toBeNull();
    });
});
