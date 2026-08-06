"use client";

import * as React from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/** The blank-slate path: name it first, configure it after. */
export function CreateAgentDialog() {
  const [name, setName] = React.useState("");

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button variant="outline" size="lg" className="cursor-pointer">
            <Plus data-icon="inline-start" />
            Create from scratch
          </Button>
        }
      />

      <DialogContent className="gap-0 rounded-2xl p-0 sm:max-w-md">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="text-base font-medium">Name your agent</DialogTitle>
        </DialogHeader>

        <div className="px-6 pt-4 pb-5">
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Sales bot"
            aria-label="Agent name"
            className="h-10 w-full rounded-lg border border-border bg-transparent px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-foreground/40"
          />
        </div>

        <DialogFooter className="mx-0 mt-0 mb-0 gap-2 border-0 bg-transparent px-6 pt-0 pb-6">
          <DialogClose
            render={
              <Button variant="ghost" size="lg" className="cursor-pointer">
                Cancel
              </Button>
            }
          />
          <Button size="lg" disabled={!name.trim()} className="cursor-pointer">
            Create agent
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
