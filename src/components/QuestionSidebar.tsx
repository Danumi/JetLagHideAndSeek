import { useStore } from "@nanostores/react";
import { SidebarCloseIcon } from "lucide-react";

import {
    Sidebar,
    SidebarContent,
    SidebarContext,
    SidebarGroup,
    SidebarGroupContent,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar-l";
import {
    hiderMode,
    isLoading,
    photoQuestions,
    questions,
    showAllQuestionTypes,
    triggerLocalRefresh,
} from "@/lib/context";
import { t, useLanguage } from "@/lib/i18n";
import { isLogged } from "@/maps/answers";

import { AddQuestionDialog } from "./AddQuestionDialog";
import { QuestionLogRow } from "./cards/answer";
import { PhotoLogRow, PhotoQuestionCard } from "./cards/photo";
import { MoveButton } from "./MoveCard";
import {
    MatchingQuestionComponent,
    MeasuringQuestionComponent,
    RadiusQuestionComponent,
    TentacleQuestionComponent,
    ThermometerQuestionComponent,
} from "./QuestionCards";

const SectionHeading = ({ children }: { children: React.ReactNode }) => (
    <h3 className="px-4 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {children}
    </h3>
);

/**
 * The questions asked so far: open ones (waiting for the answer or being
 * edited) on top as cards, answered ones below as the question log.
 */
export const QuestionSidebar = () => {
    useStore(triggerLocalRefresh);
    useLanguage();
    const $questions = useStore(questions);
    const $photoQuestions = useStore(photoQuestions);
    const $isLoading = useStore(isLoading);
    const $showAllQuestionTypes = useStore(showAllQuestionTypes);
    const $hiderMode = useStore(hiderMode);
    const open = $questions.filter((question) => !isLogged(question));
    const openPhotos = $photoQuestions.filter(
        (photo) => photo.status === "pending",
    );
    // Photos go into the log at the time they were asked
    const answered = [
        ...$questions.filter(isLogged).map((question) => ({
            at: question.data.askedAt ?? 0,
            row: <QuestionLogRow key={question.key} question={question} />,
        })),
        ...$photoQuestions
            .filter((photo) => photo.status !== "pending")
            .map((photo) => ({
                at: photo.askedAt,
                row: <PhotoLogRow key={photo.key} photo={photo} />,
            })),
    ].sort((a, b) => a.at - b.at);
    const anyOpen = open.length + openPhotos.length > 0;

    return (
        <Sidebar>
            <div className="flex items-center justify-between">
                <h2 className="ml-4 mt-4 font-poppins text-2xl">
                    {t("sidebar.title")}
                </h2>
                <SidebarCloseIcon
                    className="mr-2 visible md:hidden"
                    onClick={() => {
                        SidebarContext.get().setOpenMobile(false);
                    }}
                />
            </div>
            <SidebarContent>
                {$questions.length === 0 && $photoQuestions.length === 0 && (
                    <p className="px-4 py-2 text-sm text-muted-foreground">
                        {t("sidebar.empty")}
                    </p>
                )}
                {anyOpen && answered.length > 0 && (
                    <SectionHeading>{t("sidebar.open")}</SectionHeading>
                )}
                {open.map((question) => {
                    switch (question.id) {
                        case "radius":
                            return (
                                <RadiusQuestionComponent
                                    data={question.data}
                                    key={question.key}
                                    questionKey={question.key}
                                />
                            );
                        case "thermometer":
                            return (
                                <ThermometerQuestionComponent
                                    data={question.data}
                                    key={question.key}
                                    questionKey={question.key}
                                />
                            );
                        case "tentacles":
                            return (
                                <TentacleQuestionComponent
                                    data={question.data}
                                    key={question.key}
                                    questionKey={question.key}
                                />
                            );
                        case "matching":
                            return (
                                <MatchingQuestionComponent
                                    data={question.data}
                                    key={question.key}
                                    questionKey={question.key}
                                />
                            );
                        case "measuring":
                            return (
                                <MeasuringQuestionComponent
                                    data={question.data}
                                    key={question.key}
                                    questionKey={question.key}
                                />
                            );
                        default:
                            return null;
                    }
                })}
                {openPhotos.map((photo) => (
                    <PhotoQuestionCard key={photo.key} photo={photo} />
                ))}
                {answered.length > 0 && (
                    <SectionHeading>{t("sidebar.answered")}</SectionHeading>
                )}
                {answered.map(({ row }) => row)}
                {/* The hider has this on the hider screen */}
                {$hiderMode === false && answered.length > 0 && (
                    <div className="px-4 py-3">
                        <MoveButton className="w-full" />
                    </div>
                )}
            </SidebarContent>
            <SidebarGroup>
                <SidebarGroupContent>
                    <SidebarMenu>
                        {/* New questions come from "Ask a question"; this
                            one offers every type, for experts */}
                        {$showAllQuestionTypes && (
                            <SidebarMenuItem>
                                <AddQuestionDialog>
                                    <SidebarMenuButton disabled={$isLoading}>
                                        {t("sidebar.addQuestion")}
                                    </SidebarMenuButton>
                                </AddQuestionDialog>
                            </SidebarMenuItem>
                        )}
                    </SidebarMenu>
                </SidebarGroupContent>
            </SidebarGroup>
        </Sidebar>
    );
};
