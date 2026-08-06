"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";

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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-[13px] font-medium">{children}</span>;
}

export function VariableDialog({
  kind,
  mode,
  trigger,
  open,
  onOpenChange,
  name: initialName = "",
  fallback: initialFallback = "",
  prompt: initialPrompt = "",
  type: initialType = "string",
  inContext: initialInContext = true,
}: {
  kind: "input" | "output";
  mode: "create" | "edit";
  /** Omit when driving the dialog with open/onOpenChange instead. */
  trigger?: React.ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  name?: string;
  fallback?: string;
  prompt?: string;
  type?: string;
  inContext?: boolean;
}) {
  const [name, setName] = React.useState(initialName);

  const isInput = kind === "input";
  const title = `${mode === "create" ? "Create" : "Edit"} ${isInput ? "input" : "output"} variable`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger ? <DialogTrigger render={trigger} /> : null}

      <DialogContent className="gap-0 rounded-2xl p-0 sm:max-w-lg">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="text-base font-medium">{title}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 px-6 pt-4 pb-5">
          <label className="flex flex-col gap-1.5">
            <FieldLabel>Variable name</FieldLabel>
            <Input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={isInput ? "e.g. customer_name" : "e.g. call_summary"}
              className="h-10 px-3"
            />
          </label>

          {isInput ? (
            <>
              <label className="flex flex-col gap-1.5">
                <FieldLabel>Default value</FieldLabel>
                <Input
                  defaultValue={initialFallback}
                  placeholder="Enter default value"
                  className="h-10 px-3"
                />
              </label>

              <label className="flex items-center justify-between gap-4 rounded-xl border border-border p-3.5">
                <span className="min-w-0">
                  <FieldLabel>Include in context</FieldLabel>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Keep this variable available to the agent during the call.
                  </span>
                </span>
                <Switch defaultChecked={initialInContext} className="shrink-0 cursor-pointer" />
              </label>
            </>
          ) : (
            <>
              <label className="flex flex-col gap-1.5">
                <FieldLabel>Data type</FieldLabel>
                <Select defaultValue={initialType}>
                  <SelectTrigger className="h-10 w-full px-3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="string">Text</SelectItem>
                    <SelectItem value="number">Number</SelectItem>
                    <SelectItem value="boolean">Yes or no</SelectItem>
                  </SelectContent>
                </Select>
              </label>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <FieldLabel>Extraction prompt</FieldLabel>
                  <Button
                    variant="ghost"
                    size="xs"
                    className="cursor-pointer text-muted-foreground"
                  >
                    <Sparkles data-icon="inline-start" />
                    Improve
                  </Button>
                </div>
                <Textarea
                  rows={3}
                  defaultValue={initialPrompt}
                  placeholder="Describe what to pull out of the transcript"
                  className="min-h-24 resize-none px-3 py-2.5"
                />
              </div>
            </>
          )}
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
            {mode === "create" ? "Create variable" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
