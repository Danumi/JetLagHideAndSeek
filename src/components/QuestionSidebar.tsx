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
    isLoading,
    questions,
    showAllQuestionTypes,
    triggerLocalRefresh,
} from "@/lib/context";
import { isLogged } from "@/maps/answers";

import { AddQuestionDialog } from "./AddQuestionDialog";
import { QuestionLogRow } from "./cards/answer";
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
 * edited) on top as cards, answered ones below as the question log. The
 * numbers stay the order they were asked in, like on the map pins.
 */
export const QuestionSidebar = () => {
    useStore(triggerLocalRefresh);
    const $questions = useStore(questions);
    const $isLoading = useStore(isLoading);
    const $showAllQuestionTypes = useStore(showAllQuestionTypes);
    const open = $questions.filter((question) => !isLogged(question));
    const answered = $questions.filter(isLogged);

    return (
        <Sidebar>
            <div className="flex items-center justify-between">
                <h2 className="ml-4 mt-4 font-poppins text-2xl">Questions</h2>
                <SidebarCloseIcon
                    className="mr-2 visible md:hidden"
                    onClick={() => {
                        SidebarContext.get().setOpenMobile(false);
                    }}
                />
            </div>
            <SidebarContent>
                {$questions.length === 0 && (
                    <p className="px-4 py-2 text-sm text-muted-foreground">
                        No questions yet. Tap &quot;Ask a question&quot; below
                        the map.
                    </p>
                )}
                {open.length > 0 && answered.length > 0 && (
                    <SectionHeading>Open</SectionHeading>
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
                {answered.length > 0 && (
                    <SectionHeading>Answered</SectionHeading>
                )}
                {answered.map((question) => (
                    <QuestionLogRow
                        key={question.key}
                        question={question}
                        number={$questions.indexOf(question) + 1}
                    />
                ))}
            </SidebarContent>
            <SidebarGroup>
                <SidebarGroupContent>
                    <SidebarMenu data-tutorial-id="add-questions-buttons">
                        {/* New questions come from "Ask a question"; this
                            one offers every type, for experts */}
                        {$showAllQuestionTypes && (
                            <SidebarMenuItem>
                                <AddQuestionDialog>
                                    <SidebarMenuButton disabled={$isLoading}>
                                        Add Question
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
