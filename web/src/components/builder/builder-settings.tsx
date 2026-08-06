"use client";

import * as React from "react";
import { Plus } from "lucide-react";

import { VoicePicker } from "@/components/builder/voice-picker";
import type { Agent } from "@/components/dashboard/data";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

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
    <div className="flex flex-wrap items-center gap-4 py-4">
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
      <div className="flex shrink-0 items-center gap-3">{children}</div>
    </div>
  );
}

/** A slider that shows the number it is setting, the way a mixer does. */
function ValueSlider({
  defaultValue,
  min,
  max,
  step,
  suffix,
}: {
  defaultValue: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
}) {
  const [value, setValue] = React.useState(defaultValue);

  return (
    <div className="flex items-center gap-3">
      {/* The primitive counts thumbs from the value, so it has to be an array */}
      <Slider
        value={[value]}
        onValueChange={(next) => setValue(Array.isArray(next) ? next[0] : next)}
        min={min}
        max={max}
        step={step}
        className="w-32"
        aria-label="Value"
      />
      <span className="flex h-8 w-16 items-center justify-center rounded-full border border-border font-mono text-xs tabular-nums">
        {value.toFixed(2)}
      </span>
      {suffix ? <span className="w-3 text-xs text-muted-foreground">{suffix}</span> : null}
    </div>
  );
}

const selectClass = "h-9 w-52 rounded-full px-3";

export function BuilderSettings({ agent }: { agent: Agent }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-3xl min-w-0 flex-col gap-8 divide-y divide-border">
        {/* What it sounds like */}
        <Section title="Speaking">
          <Row label="Provider" hint="Whose speech engine it speaks through">
            <Select defaultValue="sarvam">
              <SelectTrigger className={selectClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sarvam">Sarvam</SelectItem>
                <SelectItem value="elevenlabs">ElevenLabs</SelectItem>
                <SelectItem value="cartesia">Cartesia</SelectItem>
              </SelectContent>
            </Select>
          </Row>

          <Row label="Model" hint="Newer models sound better but cost more">
            <Select defaultValue="bulbul-v2">
              <SelectTrigger className={selectClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bulbul-v2">bulbul v2</SelectItem>
                <SelectItem value="bulbul-v1">bulbul v1</SelectItem>
              </SelectContent>
            </Select>
          </Row>

          <Row label="Voice" hint="Who your agent sounds like">
            <VoicePicker defaultValue={agent.voice} />
          </Row>

          <Row label="Speaking speed" hint="How fast the agent talks">
            <ValueSlider defaultValue={1.15} min={0.5} max={2} step={0.05} suffix="x" />
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
          <Row label="Model" hint="Faster replies, or more careful ones">
            <Select defaultValue="balanced">
              <SelectTrigger className={selectClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fast">Fast</SelectItem>
                <SelectItem value="balanced">Balanced</SelectItem>
                <SelectItem value="careful">Careful</SelectItem>
              </SelectContent>
            </Select>
          </Row>

          <Row label="Creativity" hint="Low sticks to the script, high improvises">
            <ValueSlider defaultValue={0.4} min={0} max={1} step={0.05} />
          </Row>

          <Row label="Answer length" hint="How much it says before handing the turn back">
            <Select defaultValue="short">
              <SelectTrigger className={selectClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="short">A sentence or two</SelectItem>
                <SelectItem value="normal">As long as it needs</SelectItem>
              </SelectContent>
            </Select>
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
          <Row label="Transcription" hint="The engine turning speech into text">
            <Select defaultValue="sarvam">
              <SelectTrigger className={selectClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sarvam">Sarvam</SelectItem>
                <SelectItem value="whisper">Whisper</SelectItem>
              </SelectContent>
            </Select>
          </Row>

          <Row label="Let callers interrupt" hint="It stops talking the moment they speak">
            <Switch defaultChecked />
          </Row>

          <Row label="Wait before replying" hint="How long a pause means the caller has finished">
            <ValueSlider defaultValue={0.6} min={0.2} max={2} step={0.05} suffix="s" />
          </Row>

          <Row label="Noise filter" hint="Ignore traffic, TVs, and other rooms" advanced>
            <Switch />
          </Row>
        </Section>
      </div>
    </div>
  );
}
