"use client";

import * as React from "react";
import { Plus } from "lucide-react";

import { MascotPicker } from "@/components/builder/mascot-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const [mascot, setMascot] = React.useState<string | null>(null);

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

        <div className="flex items-center gap-3 px-6 pt-4 pb-5">
          <MascotPicker name={name || "Agent"} value={mascot} onChange={setMascot} size={36} />

          <Input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Sales bot"
            aria-label="Agent name"
            className="h-10 min-w-0 flex-1 px-3"
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
