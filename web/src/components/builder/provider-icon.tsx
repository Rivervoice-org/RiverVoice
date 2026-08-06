"use client";

import Anthropic from "@lobehub/icons/es/Anthropic";
import AssemblyAI from "@lobehub/icons/es/AssemblyAI";
import Azure from "@lobehub/icons/es/Azure";
import ElevenLabs from "@lobehub/icons/es/ElevenLabs";
import Gemini from "@lobehub/icons/es/Gemini";
import Groq from "@lobehub/icons/es/Groq";
import OpenAI from "@lobehub/icons/es/OpenAI";

import { cn } from "@/lib/utils";

/**
 * Real provider marks, monochrome so they sit quietly in a select. Providers
 * the icon set does not carry fall back to a monogram rather than an invented
 * logo.
 */
const MARKS: Record<string, React.ComponentType<{ size?: number }>> = {
  Anthropic,
  OpenAI,
  Google: Gemini,
  ElevenLabs,
  AssemblyAI,
  Azure,
  Groq,
};

export function ProviderIcon({ name, className }: { name: string; className?: string }) {
  const Mark = MARKS[name];

  if (!Mark) {
    return (
      <span
        aria-hidden
        className={cn(
          "flex size-4 shrink-0 items-center justify-center rounded bg-muted text-[9px] font-semibold text-muted-foreground",
          className,
        )}
      >
        {name.slice(0, 1)}
      </span>
    );
  }

  return (
    <span
      aria-label={name}
      role="img"
      className={cn("flex size-4 shrink-0 items-center", className)}
    >
      <Mark size={16} />
    </span>
  );
}
