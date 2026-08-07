"use client";

import * as React from "react";
import { Building2, CarFront, Headset, Play, Plus, Volume2, VolumeX } from "lucide-react";

import { LANGUAGES, LanguagesPicker, glyphFor } from "@/components/builder/language-picker";
import { NudgeList } from "@/components/builder/nudge-list";
import { ProviderIcon } from "@/components/builder/provider-icon";
import { VoicePicker } from "@/components/builder/voice-picker";
import type { Agent } from "@/lib/agents/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col">
      <h2 className="pb-2 text-sm font-semibold">{title}</h2>
      <div className="flex flex-col">{children}</div>
    </section>
  );
}

/** Label and explanation on the left, the control on the right. */
function Row({
  label,
  hint,
  advanced,
  children,
}: {
  label: string;
  hint: string;
  advanced?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-[13px] font-medium">{label}</p>
          {advanced ? (
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
              Advanced
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 text-[13px] text-muted-foreground">{hint}</p>
      </div>
      <div className="flex w-full min-w-0 items-center gap-3 sm:w-auto sm:shrink-0">{children}</div>
    </div>
  );
}

/** A slider that shows the number it is setting, the way a mixer does. */
function ValueSlider({
  defaultValue,
  min,
  max,
  step,
}: {
  defaultValue: number;
  min: number;
  max: number;
  step: number;
}) {
  const [value, setValue] = React.useState(defaultValue);

  return (
    <div className="flex w-full min-w-0 items-center gap-3 sm:w-auto">
      {/* The primitive counts thumbs from the value, so it has to be an array */}
      <Slider
        value={[value]}
        onValueChange={(next) => setValue(Array.isArray(next) ? next[0] : next)}
        min={min}
        max={max}
        step={step}
        className="min-w-0 flex-1 sm:w-32 sm:flex-none"
        aria-label="Value"
      />
      <span className="flex h-8 w-16 items-center justify-center rounded-full border border-border font-mono text-xs tabular-nums">
        {value.toFixed(2)}
      </span>
    </div>
  );
}

const selectClass = "h-9 w-full min-w-0 rounded-full px-3 sm:w-52";

/** A select that shows each option's mark, in the list and in the trigger. */
function ProviderSelect({ options, defaultValue }: { options: string[]; defaultValue: string }) {
  const [value, setValue] = React.useState(defaultValue);

  return (
    <Select value={value} onValueChange={(next) => setValue(String(next))}>
      <SelectTrigger className={cn(selectClass, "gap-2")}>
        <ProviderIcon name={value} className="text-foreground/70" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option} value={option} className="gap-2">
            <ProviderIcon name={option} className="text-foreground/70" />
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const SOUNDS = [
  { label: "No sound", icon: VolumeX },
  { label: "Quiet office", icon: Building2 },
  { label: "Call centre", icon: Headset },
  { label: "City traffic", icon: CarFront },
];

/** Pick an ambience, and hear it before you commit to it. */
function SoundSelect() {
  const [sound, setSound] = React.useState("Quiet office");
  const Mark = SOUNDS.find((option) => option.label === sound)?.icon ?? VolumeX;

  return (
    <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
      <Select value={sound} onValueChange={(next) => setSound(String(next))}>
        <SelectTrigger className={cn(selectClass, "gap-2")}>
          <Mark className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SOUNDS.map((option) => (
            <SelectItem key={option.label} value={option.label} className="gap-2">
              <option.icon className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        variant="outline"
        size="icon-lg"
        aria-label="Play the ambience"
        className="shrink-0 rounded-full text-muted-foreground"
      >
        <Play />
      </Button>
    </div>
  );
}

/** Which language the agent opens in, marked with its script. */
function StartingLanguage({ defaultValue }: { defaultValue: string }) {
  const [language, setLanguage] = React.useState(defaultValue);

  return (
    <Select value={language} onValueChange={(next) => setLanguage(String(next))}>
      <SelectTrigger className={cn(selectClass, "gap-2")}>
        <span className="w-4 shrink-0 text-center text-muted-foreground">{glyphFor(language)}</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {LANGUAGES.map((option) => (
          <SelectItem key={option.name} value={option.name} className="gap-2.5">
            <span className="w-4 shrink-0 text-center text-muted-foreground">{option.glyph}</span>
            {option.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function BuilderSettings({ agent }: { agent: Agent }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-6 sm:px-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-3xl min-w-0 flex-col gap-8 divide-y divide-border">
        {/* What it sounds like */}
        <Section title="Speaking">
          <Row label="Provider" hint="Whose speech engine it speaks through">
            <ProviderSelect options={["Sarvam", "ElevenLabs", "OpenAI"]} defaultValue="Sarvam" />
          </Row>

          <Row label="Model" hint="Newer models sound better but cost more">
            <Select defaultValue="bulbul v2">
              <SelectTrigger className={selectClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bulbul v2">bulbul v2</SelectItem>
                <SelectItem value="bulbul v1">bulbul v1</SelectItem>
              </SelectContent>
            </Select>
          </Row>

          <Row label="Voice" hint="Who your agent sounds like">
            <VoicePicker defaultValue={agent.voice} />
          </Row>

          <Row label="Speaking speed" hint="How fast the agent talks">
            <ValueSlider defaultValue={1.15} min={0.5} max={2} step={0.05} />
          </Row>

          <Row label="Pitch" hint="Higher or lower tone of voice">
            <ValueSlider defaultValue={0} min={-1} max={1} step={0.05} />
          </Row>

          <Row label="Pronunciation" hint="Teach it how names and brands should be said" advanced>
            <Button variant="secondary" size="lg" className="rounded-full px-4">
              <Plus data-icon="inline-start" />
              Upload dictionary
            </Button>
          </Row>
        </Section>

        {/* How it decides what to say */}
        <Section title="Thinking">
          <Row label="Provider" hint="Whose model does the reasoning">
            <ProviderSelect options={["Anthropic", "OpenAI", "Google"]} defaultValue="Anthropic" />
          </Row>

          <Row label="Model" hint="Faster replies, or more careful ones">
            <Select defaultValue="Claude Haiku 4.5">
              <SelectTrigger className={selectClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Claude Haiku 4.5">Claude Haiku 4.5</SelectItem>
                <SelectItem value="Claude Sonnet 5">Claude Sonnet 5</SelectItem>
                <SelectItem value="Claude Opus 5">Claude Opus 5</SelectItem>
              </SelectContent>
            </Select>
          </Row>

          <Row label="Creativity" hint="Low sticks to the script, high improvises">
            <ValueSlider defaultValue={0.4} min={0} max={1} step={0.05} />
          </Row>

          <Row
            label="Knowledge"
            hint="Answer only from attached sources, never from memory"
            advanced
          >
            <Switch defaultChecked />
          </Row>
        </Section>

        {/* How it hears the caller */}
        <Section title="Listening">
          <Row label="Provider" hint="Whose engine turns speech into text">
            <ProviderSelect
              options={["Sarvam", "OpenAI", "AssemblyAI", "Groq"]}
              defaultValue="Sarvam"
            />
          </Row>

          <Row label="Model" hint="What it uses to turn speech into text">
            <Select defaultValue="saarika v2">
              <SelectTrigger className={selectClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="saarika v2">saarika v2</SelectItem>
                <SelectItem value="saarika v1">saarika v1</SelectItem>
              </SelectContent>
            </Select>
          </Row>

          <Row label="Let callers interrupt" hint="It stops talking the moment they speak">
            <Switch defaultChecked />
          </Row>

          <Row label="Wait before replying" hint="How long a pause means the caller has finished">
            <ValueSlider defaultValue={0.6} min={0.2} max={2} step={0.05} />
          </Row>

          <Row label="Noise filter" hint="Ignore traffic, TVs, and other rooms" advanced>
            <Switch />
          </Row>
        </Section>
        {/* Which languages it works in */}
        <Section title="Language">
          <Row
            label="Switch language during call"
            hint="Follow along when the caller changes language"
          >
            <Switch defaultChecked />
          </Row>

          <Row label="Languages allowed" hint="What the agent can understand and reply in">
            <LanguagesPicker defaultValue={["Hindi", "Kannada", "English"]} />
          </Row>

          <Row label="Starting language" hint="The language the agent opens the call in">
            <StartingLanguage defaultValue="Hindi" />
          </Row>

          <Row label="Switch after" hint="Seconds of the new language before it follows">
            <Input
              type="number"
              min={0}
              max={5}
              defaultValue={2}
              aria-label="Seconds before switching"
              className="h-9 w-24 rounded-full px-3 text-center font-mono text-xs"
            />
          </Row>

          <Row label="Say numbers in Indic" hint="Reads 500 as paanch sau rather than five hundred">
            <Switch defaultChecked />
          </Row>
        </Section>

        {/* What the caller hears behind the voice */}
        <Section title="Environment">
          <Row label="Background sound" hint="Ambient noise behind the agent">
            <SoundSelect />
          </Row>

          <Row label="Background volume" hint="How loud the ambience plays">
            <div className="flex items-center gap-3">
              <Volume2 className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
              <ValueSlider defaultValue={0.25} min={0} max={1} step={0.05} />
            </div>
          </Row>
        </Section>
        {/* What it does when the call stalls */}
        <Section title="In call actions">
          <Row label="Nudge quiet callers" hint="Speak up if the caller goes silent for a while">
            <Switch defaultChecked />
          </Row>

          <div className="pb-4">
            <NudgeList />
          </div>

          <Row label="Hang up after the last nudge" hint="End the call if there is still no answer">
            <Switch defaultChecked />
          </Row>

          <Row label="Leave a voicemail" hint="When an answering machine picks up instead">
            <Switch defaultChecked />
          </Row>

          <Row label="Voicemail message" hint="What the agent says to the machine">
            <Textarea
              rows={3}
              defaultValue="Hi, this is Rivervoice calling. I will try you again later."
              aria-label="Voicemail message"
              className="min-h-20 w-full resize-none rounded-lg px-3 py-2.5 text-[13px] sm:w-80"
            />
          </Row>

          <Row label="Longest call" hint="Hangs up after this many minutes, however it is going">
            <Input
              type="number"
              min={1}
              max={20}
              defaultValue={15}
              aria-label="Minutes"
              className="h-9 w-24 rounded-full px-3 text-center font-mono text-xs"
            />
          </Row>
        </Section>
      </div>
    </div>
  );
}
