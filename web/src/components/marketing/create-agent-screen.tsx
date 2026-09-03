import { Check, MousePointer2, Pencil, PhoneCall, Play } from "lucide-react";

import { Mascot } from "@/mascots";
import { DemoStage } from "@/components/marketing/demo-stage";
import { cn } from "@/lib/utils";

/**
 * An exact replica of the top of mobile/screens/AgentNew — same profile
 * block, same chip groups, same mode list, same copy. Nothing here was
 * invented: every string and every layout decision is lifted straight from
 * that screen.
 *
 * A simulated cursor plays the part of the person filling it in: it moves to
 * the name, then clicks a language, a mode, a gender, and a voice — each one
 * plain until that click lands, picked from then on — one 18s timeline
 * shared by the cursor, the screen's own scroll, a click-ring, and a small
 * push-in on each click (see the `demo-*` keyframes in globals.css for the
 * full choreography and why the loop seam never jumps).
 */

const LANGUAGES = ["English", "Hindi", "Telugu", "Tamil", "Kannada"];

const MODES = [
  { label: "Formal", description: "Polished, formal wording" },
  { label: "Modern Colloquial", description: "Everyday conversational tone" },
  { label: "Classic Colloquial", description: "Traditional, literary phrasing" },
  { label: "Code Mixed", description: "Blends English with the target language" },
];

const GENDERS = ["Female", "Male", "Neutral"];

const VOICES = ["priya", "neha", "pooja"];

function SectionLabel({ children }: { children: string }) {
  return (
    <span className="text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
      {children}
    </span>
  );
}

function Chip({
  label,
  selected,
  demoToggle,
}: {
  label: string;
  selected?: boolean;
  /** Plain until the cursor's click lands on it — that click is what picks it. */
  demoToggle?: "lang" | "gender";
}) {
  if (demoToggle) {
    return (
      <span
        className={cn(
          "rounded-full border px-3 py-1.5 text-[12px] font-medium",
          demoToggle === "lang" ? "demo-lang-select" : "demo-gender-select",
        )}
        style={{
          backgroundColor: "var(--color-foreground)",
          color: "var(--color-background)",
          borderColor: "var(--color-foreground)",
        }}
      >
        {label}
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-block rounded-full border px-3 py-1.5 text-[12px] font-medium",
        selected
          ? "border-transparent bg-foreground text-background"
          : "border-border bg-card text-foreground",
      )}
    >
      {label}
    </span>
  );
}

function ModeRow({
  label,
  description,
  selected,
  demoToggle,
}: {
  label: string;
  description: string;
  selected?: boolean;
  demoToggle?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border bg-card px-3.5 py-3",
        demoToggle && "demo-mode-select",
      )}
      style={{ borderColor: selected ? "var(--foreground)" : "var(--border)" }}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>
      </div>
      <Check
        size={16}
        strokeWidth={2}
        className={cn("shrink-0 text-foreground", demoToggle && "demo-mode-check")}
        style={{ opacity: selected ? 1 : 0 }}
      />
    </div>
  );
}

function VoiceRow({
  label,
  selected,
  demoToggle,
}: {
  label: string;
  selected?: boolean;
  /** Plain until the play button gets pressed — that press is what picks it. */
  demoToggle?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border bg-card px-3.5 py-3",
        demoToggle && "demo-voice-select",
      )}
      style={{ borderColor: selected ? "var(--foreground)" : "var(--border)" }}
    >
      <span
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full bg-secondary",
          demoToggle && "demo-press-b",
        )}
      >
        <Play size={13} strokeWidth={1.75} className="ml-0.5 text-foreground" fill="currentColor" />
      </span>
      <span className="flex-1 text-sm font-medium text-foreground capitalize">{label}</span>
      <Check
        size={16}
        strokeWidth={2}
        className={cn("text-foreground", demoToggle && "demo-voice-check")}
        style={{ opacity: selected ? 1 : 0 }}
      />
    </div>
  );
}

/** Plays the part of a hand on a trackpad — moves, and flashes a ring and a
 * small push-in on the whole screen right as each of its four clicks land. */
function DemoCursor() {
  return (
    <div
      className="demo-cursor pointer-events-none absolute z-10 -translate-x-1 -translate-y-1"
      style={{ left: 228, top: 140 }}
    >
      <span
        aria-hidden
        className="demo-click-ring absolute top-1/2 left-1/2 block h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: "var(--color-foreground)" }}
      />
      <MousePointer2
        size={20}
        strokeWidth={1.5}
        className="relative text-foreground drop-shadow-sm"
        fill="var(--color-background)"
      />
    </div>
  );
}

export function CreateAgentScreen() {
  return (
    <DemoStage className="demo-zoom mx-auto w-full max-w-[400px]">
      {/* Body — the cursor drives the scroll through the whole form on a loop */}
      <div className="h-[400px] overflow-hidden">
        <div className="form-autoscroll relative px-5">
          <DemoCursor />

          {/* Profile block */}
          <div className="flex flex-col items-center pt-6 pb-8">
            <div className="relative">
              <Mascot seed="Front desk" size={88} />
              <span className="absolute right-0 bottom-0 flex h-7 w-7 items-center justify-center rounded-full border-2 border-canvas bg-foreground">
                <Pencil size={11} strokeWidth={2} className="text-background" />
              </span>
            </div>
            <div className="mt-4 flex items-baseline gap-0.5">
              <span className="demo-name-type text-[20px] font-semibold tracking-[-0.01em] text-foreground">
                Front desk
              </span>
              <span aria-hidden className="caret-blink -mb-0.5 h-5 w-px bg-foreground" />
            </div>
            <span className="mt-1 text-[13px] text-muted-foreground">Give your agent a name</span>
          </div>

          {/* Settings */}
          <div className="flex flex-col gap-7 pb-8">
            <div className="flex flex-col gap-2.5">
              <SectionLabel>Input language</SectionLabel>
              <div className="flex flex-wrap gap-1.5">
                {LANGUAGES.map((lang, i) => (
                  <Chip
                    key={lang}
                    label={lang}
                    selected={i === 0}
                    demoToggle={i === 0 ? "lang" : undefined}
                  />
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <SectionLabel>Output language</SectionLabel>
              <div className="flex flex-wrap gap-1.5">
                {LANGUAGES.map((lang) => (
                  <Chip key={lang} label={lang} />
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <SectionLabel>Mode</SectionLabel>
              <div className="flex flex-col gap-2">
                {MODES.map((mode, i) => (
                  <ModeRow key={mode.label} {...mode} selected={i === 1} demoToggle={i === 1} />
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <SectionLabel>Voice gender</SectionLabel>
              <div className="flex flex-wrap gap-1.5">
                {GENDERS.map((g, i) => (
                  <Chip
                    key={g}
                    label={g}
                    selected={i === 0}
                    demoToggle={i === 0 ? "gender" : undefined}
                  />
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <SectionLabel>Voice</SectionLabel>
              <div className="flex flex-col gap-2">
                {VOICES.map((v, i) => (
                  <VoiceRow
                    key={v}
                    label={v}
                    selected={i === VOICES.length - 1}
                    demoToggle={i === VOICES.length - 1}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer — matches FormFooter's two buttons */}
      <div className="flex gap-3 border-t border-border px-5 pt-3 pb-4">
        <span className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-border py-2.5">
          <PhoneCall size={15} strokeWidth={1.75} className="text-foreground" />
          <span className="text-[13px] font-medium text-foreground">Try agent</span>
        </span>
        <span className="flex flex-1 items-center justify-center rounded-lg bg-foreground py-2.5">
          <span className="text-[13px] font-medium text-background">Create agent</span>
        </span>
      </div>
    </DemoStage>
  );
}
