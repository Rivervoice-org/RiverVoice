"use client";

import * as React from "react";
import { ChevronDown, X } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** A glyph from each script, so the list is scannable without reading. */
export const LANGUAGES = [
  { name: "Hindi", glyph: "अ" },
  { name: "Bengali", glyph: "অ" },
  { name: "Kannada", glyph: "ಕ" },
  { name: "Tamil", glyph: "அ" },
  { name: "Telugu", glyph: "త" },
  { name: "Marathi", glyph: "म" },
  { name: "Gujarati", glyph: "ગ" },
  { name: "Malayalam", glyph: "മ" },
  { name: "Punjabi", glyph: "ਪ" },
  { name: "Odia", glyph: "ଓ" },
  { name: "English", glyph: "A" },
];

export function glyphFor(name: string) {
  return LANGUAGES.find((language) => language.name === name)?.glyph ?? "A";
}

function Chip({ label, onRemove }: { label: string; onRemove?: () => void }) {
  return (
    <span className="flex h-6 shrink-0 items-center gap-1 rounded-full bg-muted px-2 text-xs">
      {label}
      {onRemove ? (
        <span
          role="button"
          tabIndex={-1}
          aria-label={`Remove ${label}`}
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="size-3" />
        </span>
      ) : null}
    </span>
  );
}

/** Many languages at once, shown as chips you can drop from the trigger. */
export function LanguagesPicker({ defaultValue }: { defaultValue: string[] }) {
  const [selected, setSelected] = React.useState(defaultValue);

  const toggle = (name: string) =>
    setSelected((current) =>
      current.includes(name) ? current.filter((item) => item !== name) : [...current, name],
    );

  const [first, second, ...rest] = selected;

  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="flex h-9 w-64 cursor-pointer items-center gap-1.5 rounded-full border border-input px-2 pr-3 text-sm transition-colors hover:bg-muted/60 focus-visible:border-foreground/30 focus-visible:outline-none"
          />
        }
      >
        {selected.length === 0 ? (
          <span className="flex-1 px-1 text-left text-muted-foreground">Any language</span>
        ) : (
          <span className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
            {first ? <Chip label={first} onRemove={() => toggle(first)} /> : null}
            {second ? <Chip label={second} onRemove={() => toggle(second)} /> : null}
            {rest.length > 0 ? <Chip label={`+${rest.length}`} /> : null}
          </span>
        )}
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>

      <PopoverContent align="end" className="w-64 p-1">
        <div className="flex max-h-72 flex-col overflow-y-auto">
          {LANGUAGES.map((language) => {
            const checked = selected.includes(language.name);
            return (
              <button
                key={language.name}
                type="button"
                onClick={() => toggle(language.name)}
                className="flex h-9 cursor-pointer items-center gap-2.5 rounded-md px-2 text-left text-[13px] transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
              >
                <Checkbox checked={checked} className="pointer-events-none" />
                <span className="w-4 shrink-0 text-center text-muted-foreground">
                  {language.glyph}
                </span>
                <span className={cn("min-w-0 flex-1 truncate", checked && "font-medium")}>
                  {language.name}
                </span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
