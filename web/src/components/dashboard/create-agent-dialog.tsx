"use client";

import * as React from "react";
import { useForm } from "@tanstack/react-form";
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
import { useCreateAgent } from "@/lib/agents/queries";
import { createAgentSchema } from "@/lib/agents/schemas";

/** The blank-slate path: name it first, configure it after. */
export function CreateAgentDialog() {
  const createAgent = useCreateAgent();

  const form = useForm({
    defaultValues: { name: "", mascot: "" },
    validators: { onChange: createAgentSchema },
    onSubmit: ({ value }) => createAgent.mutateAsync(value),
  });

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
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            form.handleSubmit();
          }}
        >
          <DialogHeader className="px-6 pt-6">
            <DialogTitle className="text-base font-medium">Name your agent</DialogTitle>
          </DialogHeader>

          <div className="flex items-center gap-3 px-6 pt-4">
            <form.Field name="mascot">
              {(mascot) => (
                <form.Subscribe selector={(state) => state.values.name}>
                  {(name) => (
                    <MascotPicker
                      name={name || "Agent"}
                      value={mascot.state.value || null}
                      onChange={(face) => mascot.handleChange(face ?? "")}
                      size={36}
                    />
                  )}
                </form.Subscribe>
              )}
            </form.Field>

            <form.Field name="name">
              {(field) => (
                <Input
                  autoFocus
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="e.g. Sales bot"
                  aria-label="Agent name"
                  className="h-10 min-w-0 flex-1 px-3"
                />
              )}
            </form.Field>
          </div>

          {createAgent.error ? (
            <p role="alert" className="px-6 pt-3 text-[13px] text-destructive">
              {createAgent.error.message}
            </p>
          ) : null}

          <DialogFooter className="mx-0 mt-0 mb-0 gap-2 border-0 bg-transparent px-6 pt-5 pb-6">
            <DialogClose
              render={
                <Button variant="ghost" size="lg" type="button" className="cursor-pointer">
                  Cancel
                </Button>
              }
            />
            <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting] as const}>
              {([canSubmit, isSubmitting]) => (
                <Button
                  size="lg"
                  type="submit"
                  disabled={!canSubmit || isSubmitting}
                  className="cursor-pointer"
                >
                  {isSubmitting ? "Creating…" : "Create agent"}
                </Button>
              )}
            </form.Subscribe>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
