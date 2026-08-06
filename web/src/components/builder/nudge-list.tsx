"use client";

import * as React from "react";
import { GripVertical, Languages, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Nudge = { id: number; text: string; after: number };

const INITIAL: Nudge[] = [
  { id: 1, text: "Hello? Are you still there?", after: 5 },
  { id: 2, text: "I will hang up shortly if I cannot hear you.", after: 10 },
];

/** What the agent says when the line goes quiet, and how long it waits. */
export function NudgeList() {
  const [nudges, setNudges] = React.useState(INITIAL);
  const nextId = React.useRef(INITIAL.length + 1);

  const add = () =>
    setNudges((current) => [
      ...current,
      { id: nextId.current++, text: "", after: (current.at(-1)?.after ?? 0) + 5 },
    ]);

  const remove = (id: number) => setNudges((current) => current.filter((item) => item.id !== id));

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-muted/50 p-4">
      {nudges.map((nudge, index) => (
        <div key={nudge.id} className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
            <GripVertical className="size-3.5 cursor-grab" />
            Message {index + 1}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Input
              defaultValue={nudge.text}
              placeholder="What it says to break the silence"
              aria-label={`Message ${index + 1}`}
              className="h-9 min-w-0 flex-1 rounded-lg bg-background px-3"
            />

            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Translations for this message"
              className="text-muted-foreground"
            >
              <Languages />
            </Button>

            <span className="text-[13px] text-muted-foreground">after</span>
            <Input
              type="number"
              min={1}
              max={60}
              defaultValue={nudge.after}
              aria-label="Seconds of silence"
              className="h-9 w-20 rounded-lg bg-background px-3 text-center font-mono text-xs"
            />
            <span className="text-[13px] text-muted-foreground">seconds</span>

            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Remove message ${index + 1}`}
              onClick={() => remove(nudge.id)}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 />
            </Button>
          </div>
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button variant="secondary" size="lg" className="rounded-full px-3" onClick={add}>
          <Plus data-icon="inline-start" />
          Add message
        </Button>
        <Button variant="ghost" size="lg" className="rounded-full px-3 text-muted-foreground">
          <Languages data-icon="inline-start" />
          Redo translations
        </Button>
      </div>
    </div>
  );
}
