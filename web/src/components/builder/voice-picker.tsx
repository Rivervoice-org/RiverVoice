"use client";

import * as React from "react";
import { ChevronDown, Play, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const VOICES = ["Meera", "Arden", "Nell", "Kavya", "Rohan", "Isla"];

/** Pick a voice, and hear it before you commit to it. */
export function VoicePicker({ defaultValue }: { defaultValue: string }) {
  const [open, setOpen] = React.useState(false);
  const [voice, setVoice] = React.useState(defaultValue);
  const [query, setQuery] = React.useState("");

  const matches = VOICES.filter((name) => name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="flex h-9 w-52 cursor-pointer items-center gap-2 rounded-full border border-input px-3 text-sm transition-colors hover:bg-muted/60 focus-visible:border-foreground/30 focus-visible:outline-none"
          />
        }
      >
        <span
          role="button"
          tabIndex={-1}
          aria-label={`Play a sample of ${voice}`}
          onClick={(event) => event.stopPropagation()}
          className="flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Play className="size-3" />
        </span>
        <span className="min-w-0 flex-1 truncate text-left">{voice}</span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>

      <PopoverContent align="end" className="w-60 bg-popover p-1">
        <div className="relative p-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search voices"
            aria-label="Search voices"
            className="h-8 rounded-md pr-2 pl-8"
          />
        </div>

        <div className="mt-1 flex max-h-64 flex-col overflow-y-auto">
          {matches.length === 0 ? (
            <p className="px-2 py-6 text-center text-[13px] text-muted-foreground">
              No voice by that name.
            </p>
          ) : (
            matches.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => {
                  setVoice(name);
                  setOpen(false);
                }}
                className="flex h-9 cursor-pointer items-center gap-2 rounded-md px-2 text-left text-[13px] transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
              >
                {/* Preview without choosing */}
                <span
                  role="button"
                  tabIndex={-1}
                  aria-label={`Play a sample of ${name}`}
                  onClick={(event) => event.stopPropagation()}
                  className="flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Play className="size-3" />
                </span>
                <span className={cn("min-w-0 flex-1 truncate", voice === name && "font-medium")}>
                  {name}
                </span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
