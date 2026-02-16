import * as React from "react";
import { type DialogProps } from "@radix-ui/react-dialog";
import { Command as CommandPrimitive } from "cmdk";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

const CommandDialog = ({ children, ...props }: CommandDialogProps) => {
  return (
    <Dialog {...props}>
      <DialogContent className="overflow-hidden p-0 shadow-lg">
        <DialogHeader>
          <DialogTitle className="sr-only">Command</DialogTitle>
        </DialogHeader>
        <CommandPrimitive className="flex flex-row items-center">
          <Search className="w-5 h-5" />
          <CommandPrimitive.Content>
            {children}
          </CommandPrimitive.Content>
        </CommandPrimitive>
      </DialogContent>
    </Dialog>
  );
};
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";