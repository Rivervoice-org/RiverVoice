"use client";

import * as React from "react";
import { Pencil, RotateCcw } from "lucide-react";

import {
  MASCOT_STYLE_IDS,
  Mascot,
  type MascotStyleId,
  mascotDataUri,
  mascotRef,
  mascotStyle,
  parseMascot,
  warmMascots,
} from "@/components/dashboard/mascot";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const SEEDS = [
  "Aarav",
  "Ananya",
  "Bilal",
  "Chitra",
  "Dev",
  "Eesha",
  "Farhan",
  "Gauri",
  "Hari",
  "Ira",
  "Jai",
  "Kabir",
  "Lakshmi",
  "Meera",
  "Nikhil",
  "Omkar",
  "Priya",
  "Rhea",
];

const FACE_SIZE = 36;

function refsFor(style: MascotStyleId) {
  return SEEDS.map((seed) => mascotRef(style, seed));
}

function FaceImage({ face }: { face: string }) {
  const [loaded, setLoaded] = React.useState(false);

  return (
    <span className="relative block size-9 overflow-hidden rounded-full bg-muted">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={mascotDataUri(face, FACE_SIZE)}
        alt=""
        width={FACE_SIZE}
        height={FACE_SIZE}
        decoding="async"
        onLoad={() => setLoaded(true)}
        className={cn(
          "absolute inset-0 size-9 transition-opacity duration-200",
          loaded ? "opacity-100" : "opacity-0",
        )}
      />
    </span>
  );
}

const Face = React.memo(function Face({
  face,
  label,
  selected,
  onSelect,
}: {
  face: string;
  label: string;
  selected: boolean;
  onSelect: (face: string) => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      onClick={() => onSelect(face)}
      className={cn(
        "flex cursor-pointer items-center justify-center rounded-full p-0.5 transition-colors",
        "focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
        selected ? "ring-2 ring-foreground" : "hover:bg-accent",
      )}
    >
      <FaceImage face={face} />
    </button>
  );
});

/** Two of the styles are CC BY, which obliges us to name the work and author. */
function Credit({ style }: { style: MascotStyleId }) {
  const { label, meta } = mascotStyle(style);
  const link = "underline-offset-2 hover:text-foreground hover:underline";
  const title = meta.title ?? label;

  return (
    <p className="text-[10px] leading-snug text-muted-foreground/80">
      {meta.source ? (
        <a href={meta.source} target="_blank" rel="noreferrer" className={link}>
          {title}
        </a>
      ) : (
        title
      )}
      {meta.creator ? ` by ${meta.creator}` : null}
      {meta.license ? (
        <>
          {" · "}
          {meta.license.url ? (
            <a href={meta.license.url} target="_blank" rel="noreferrer" className={link}>
              {meta.license.name}
            </a>
          ) : (
            meta.license.name
          )}
        </>
      ) : null}
    </p>
  );
}

export function MascotPicker({
  name,
  value,
  onChange,
  size = 26,
}: {
  name: string;
  value: string | null;
  onChange: (face: string | null) => void;
  size?: number;
}) {
  const [open, setOpen] = React.useState(false);
  const current = value ?? name;
  const [style, setStyle] = React.useState<MascotStyleId>(() => parseMascot(current).style);

  // Only the visible style is drawn, so switching tabs stays cheap.
  React.useEffect(() => {
    const run = () => warmMascots(refsFor(style), FACE_SIZE);

    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(run);
      return () => window.cancelIdleCallback(id);
    }

    const id = window.setTimeout(run, 300);
    return () => window.clearTimeout(id);
  }, [style]);

  const select = React.useCallback((face: string) => onChange(face), [onChange]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={`Change mascot for ${name}`}
            className="group/mascot relative cursor-pointer rounded-full focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
          />
        }
      >
        <Mascot seed={current} size={size} />
        <span
          aria-hidden
          className="absolute -right-0.5 -bottom-0.5 grid size-3.5 place-items-center rounded-full bg-foreground text-background opacity-0 transition-opacity group-hover/mascot:opacity-100 group-aria-expanded/mascot:opacity-100"
        >
          <Pencil className="size-2" strokeWidth={2.5} />
        </span>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-[19.5rem]">
        <PopoverHeader>
          <PopoverTitle>Mascot</PopoverTitle>
          <PopoverDescription>
            The face that stands for this agent everywhere you see it.
          </PopoverDescription>
        </PopoverHeader>

        <div className="-mx-2.5 flex gap-1 overflow-x-auto px-2.5 pb-0.5">
          {MASCOT_STYLE_IDS.map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={style === id}
              onClick={() => setStyle(id)}
              className={cn(
                "h-6 shrink-0 cursor-pointer rounded-full px-2.5 text-[11px] transition-colors",
                "focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
                style === id
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-accent",
              )}
            >
              {mascotStyle(id).label}
            </button>
          ))}
        </div>

        <div
          role="radiogroup"
          aria-label={`${mascotStyle(style).label} mascots`}
          className="-mx-0.5 grid grid-cols-6 gap-1 px-0.5 py-0.5"
        >
          {SEEDS.map((seed, index) => {
            const face = mascotRef(style, seed);
            return (
              <Face
                key={face}
                face={face}
                label={`${mascotStyle(style).label} ${index + 1}`}
                selected={value === face}
                onSelect={select}
              />
            );
          })}
        </div>

        <Credit style={style} />

        <button
          type="button"
          disabled={value === null}
          onClick={() => onChange(null)}
          className="flex h-8 cursor-pointer items-center gap-2 rounded-md px-2 text-[13px] transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40"
        >
          <RotateCcw className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
          Go back to the one the name picked
        </button>
      </PopoverContent>
    </Popover>
  );
}
