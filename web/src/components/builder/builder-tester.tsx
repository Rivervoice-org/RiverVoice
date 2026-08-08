"use client";

import * as React from "react";
import { Braces, Globe, History, PanelRight, Settings2, Volume2 } from "lucide-react";

import { BubbleIcon, HandsetIcon, MicIcon } from "@/components/builder/test-icons";
import { ChatScene, PhoneScene, VoiceScene } from "@/motion/builder/test-scenes";
import { inputVariables } from "@/components/dashboard/data";
import type { Agent } from "@/lib/agents/types";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsIndicator, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type Mode = "voice" | "phone" | "chat";

const MODES = [
  { value: "voice", label: "Voice", icon: MicIcon },
  { value: "phone", label: "Phone", icon: HandsetIcon },
  { value: "chat", label: "Chat", icon: BubbleIcon },
] as const;

const IDLE: Record<
  Mode,
  { scene: React.ComponentType<{ seed: string }>; caption: string; action: string }
> = {
  voice: {
    scene: VoiceScene,
    caption: "Start a call to test the agent",
    action: "Start call",
  },
  phone: {
    scene: PhoneScene,
    caption: "Enter a number and place an outbound call",
    action: "Call",
  },
  chat: {
    scene: ChatScene,
    caption: "Start testing by sending a message",
    action: "Start chat",
  },
};

/** The voices this agent could answer in, so the picker is not a free-text box. */
const VOICES = ["Meera", "Ritu", "Aarav", "Kabir", "Ananya"];

function Meta({ icon: Icon, children }: { icon: typeof Globe; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
      <Icon className="size-3.5" strokeWidth={1.75} />
      {children}
    </span>
  );
}

/**
 * The panel you try the agent in before anyone real does.
 *
 * Three ways in, one setup. Voice and Chat run against the draft in the browser;
 * Phone dials out to a number you type. The three share the language, the voice
 * and the variables, because changing them per mode would mean you had tested
 * three different agents.
 */
export function BuilderTester({
  agent,
  mascot,
  onClose,
}: {
  agent: Agent;
  /** The face currently picked in the topbar, which may not be saved yet. */
  mascot: string | null;
  onClose: () => void;
}) {
  const [mode, setMode] = React.useState<Mode>("voice");
  const [setupOpen, setSetupOpen] = React.useState(false);

  // Seeded from the agent, then held locally: a test run should not be able to
  // edit the agent, only to try it a different way.
  const [language, setLanguage] = React.useState(agent.startingLanguage);
  const [voice, setVoice] = React.useState(agent.voice);
  const [number, setNumber] = React.useState("");
  const [values, setValues] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(inputVariables.map((variable) => [variable.name, variable.fallback])),
  );

  const languages = agent.languages.length ? agent.languages : [agent.startingLanguage];
  const set = inputVariables.filter((variable) => values[variable.name]?.trim()).length;
  const dialled = number.trim().length >= 6;

  const idle = IDLE[mode];
  const Scene = idle.scene;
  const action = mode === "phone" ? (dialled ? "Call 1 number" : "Call") : idle.action;

  return (
    <aside className="panel flex h-full w-full flex-col overflow-hidden">
      <header className="flex h-14 shrink-0 items-center gap-2 px-4">
        <span className="text-sm font-medium">Test agent</span>

        <div className="ml-auto flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Past test runs"
            title="Past test runs"
            className="cursor-pointer text-muted-foreground"
          >
            <History />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Hide panel"
            title="Hide panel"
            className="cursor-pointer text-muted-foreground"
            onClick={onClose}
          >
            <PanelRight />
          </Button>
        </div>
      </header>

      {/* The panel arrives in three beats rather than all at once — controls,
          then what they act on, then the thing you press. */}
      <Tabs
        value={mode}
        onValueChange={(value) => setMode(value as Mode)}
        className="animate-rise shrink-0 items-center px-4"
        style={{ animationDelay: "60ms" }}
      >
        <TabsList className="h-9 rounded-full p-1">
          <TabsIndicator className="rounded-full" />
          {MODES.map((entry) => (
            <TabsTrigger key={entry.value} value={entry.value} className="rounded-full px-3.5">
              <entry.icon data-icon="inline-start" />
              {entry.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Nothing has happened yet, so the body is the mark and the one line that
          says what to do. The transcript takes this space once a run starts. */}
      {/* Keyed on the mode, so switching tabs plays the new scene in rather than
          cutting to it — the drawings are different enough for a cut to jar. */}
      <div
        key={mode}
        className="animate-rise flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6"
        style={{ animationDelay: "120ms" }}
      >
        {/* Capped rather than filling: the scene is drawn for a wide frame, and
            letting it grow with the panel would leave the caption stranded. */}
        <div className="h-40 w-full max-w-[17rem]">
          <Scene seed={mascot ?? agent.name} />
        </div>
        <p className="text-center text-[13px] text-muted-foreground">{idle.caption}</p>
      </div>

      <div className="animate-rise shrink-0 space-y-2 p-3" style={{ animationDelay: "180ms" }}>
        {mode === "phone" ? (
          <div className="flex h-12 items-center gap-3 rounded-2xl border border-border px-4">
            <HandsetIcon className="size-4 shrink-0 text-muted-foreground" />
            <span className="shrink-0 text-sm font-medium">Call to</span>
            <Input
              type="tel"
              inputMode="tel"
              value={number}
              onChange={(event) => setNumber(event.target.value)}
              placeholder="+91 98450 22118"
              aria-label="Number to call"
              className="h-8 min-w-0 flex-1 border-0 bg-transparent px-0 text-right text-sm shadow-none focus-visible:border-0 focus-visible:ring-0 md:text-sm dark:bg-transparent"
            />
          </div>
        ) : null}

        <Collapsible open={setupOpen} onOpenChange={setSetupOpen}>
          <div className="rounded-2xl border border-border">
            <CollapsibleTrigger
              render={
                <button
                  type="button"
                  className="flex h-12 w-full cursor-pointer items-center gap-3 px-4 text-left focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                />
              }
            >
              <Settings2 className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
              <span className="shrink-0 text-sm font-medium">Setup</span>

              <span className="ml-auto flex min-w-0 items-center gap-3 truncate">
                {setupOpen ? (
                  <span className="text-[13px] text-muted-foreground">Tap to close</span>
                ) : (
                  <>
                    {/* Only Voice has a speaker to name; the others are silent. */}
                    {mode === "voice" ? <Meta icon={Volume2}>{voice}</Meta> : null}
                    <Meta icon={Globe}>{language}</Meta>
                    <Meta icon={Braces}>
                      {set}/{inputVariables.length}
                    </Meta>
                  </>
                )}
              </span>
            </CollapsibleTrigger>

            <CollapsibleContent>
              {/* Capped and scrolled: the panel is a fixed height, and the
                  variables list grows with the agent. */}
              <div className="max-h-72 space-y-4 overflow-y-auto border-t border-border px-4 py-4">
                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium">Initial language</label>
                  <Select value={language} onValueChange={(value) => setLanguage(value as string)}>
                    <SelectTrigger className="h-10 w-full rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {languages.map((entry) => (
                        <SelectItem key={entry} value={entry}>
                          {entry}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {mode === "voice" ? (
                  <div className="space-y-1.5">
                    <label className="text-[13px] font-medium">Speaker</label>
                    <Select value={voice} onValueChange={(value) => setVoice(value as string)}>
                      <SelectTrigger className="h-10 w-full rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {VOICES.map((entry) => (
                          <SelectItem key={entry} value={entry}>
                            {entry}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}

                <div className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[13px] font-medium">Agent variables</span>
                    <span className="text-[11px] text-muted-foreground">
                      {set}/{inputVariables.length} set
                    </span>
                  </div>

                  <ul className="flex flex-col">
                    {inputVariables.map((variable) => (
                      <li
                        key={variable.name}
                        className="flex items-center gap-3 border-b border-border py-2 last:border-0"
                      >
                        <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-muted-foreground">
                          {variable.name}
                        </span>
                        <Input
                          value={values[variable.name] ?? ""}
                          onChange={(event) =>
                            setValues((current) => ({
                              ...current,
                              [variable.name]: event.target.value,
                            }))
                          }
                          aria-label={variable.name}
                          placeholder={variable.fallback}
                          className="h-8 w-36 shrink-0 text-right text-[13px] md:text-[13px]"
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>

        {/* Nothing behind it yet — there is no test runner to call. Disabled
            rather than wired to a stub, so it cannot look like it half-worked. */}
        <Button
          size="lg"
          disabled
          className={cn("h-12 w-full rounded-2xl text-sm disabled:opacity-100")}
        >
          {action}
        </Button>
        <p className="text-center text-[11px] text-muted-foreground">
          Test runs are not connected yet
        </p>
      </div>
    </aside>
  );
}
