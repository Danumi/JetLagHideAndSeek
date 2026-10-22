import * as React from "react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onBlank: () => void | Promise<void>;
    onPrefill: () => void | Promise<void>;
};

export const CustomInitDialog: React.FC<Props> = ({
    open,
    onOpenChange,
    onBlank,
    onPrefill,
}) => {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>New Custom Question</DialogTitle>
                    <DialogDescription>
                        Do you want the new question to start blank, or copy
                        what the current question contains?
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="secondary" onClick={onBlank}>
                        Start blank
                    </Button>
                    <Button onClick={onPrefill}>Copy from current</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default CustomInitDialog;
