"use client";

import * as React from "react";
import Link from "next/link";
import {
  Check,
  Compass,
  Copy,
  CornerUpRight,
  FileText,
  History,
  LifeBuoy,
  Plus,
  RefreshCw,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";

import {
  answerFor,
  askGroups,
  askPrompts,
  askRecents,
  type AskAnswer,
  type AskSource,
} from "@/components/ask/ask-data";
import { AskComposer } from "@/components/ask/ask-composer";
import { Mascot } from "@/mascots";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const HINT = (
  <>
    <FileText className="size-3.5 shrink-0" strokeWidth={1.75} />
    Answers from the Rivervoice documentation
  </>
);

const sourceIcons: Record<AskSource["kind"], React.ComponentType<{ className?: string }>> = {
  docs: FileText,
  guide: Compass,
  page: CornerUpRight,
  support: LifeBuoy,
};

type Turn = { id: string; question: string; answer: AskAnswer | null };

function Suggestions({ onPick }: { onPick: (question: string) => void }) {
  return (
    <div className="mt-8 grid w-full gap-x-6 gap-y-5 sm:grid-cols-3">
      {askGroups.map((group) => (
        <div key={group.id} className="min-w-0">
          <p className="px-1 text-[11px] font-medium tracking-wide text-muted-foreground">
            {group.title}
          </p>

          <ul className="mt-1 flex flex-col">
            {group.prompts.map((id) => {
              const prompt = askPrompts.find((item) => item.id === id);
              if (!prompt) return null;
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => onPick(prompt.question)}
                    className="row-hover w-full cursor-pointer rounded-md px-1 py-2 text-left text-[13px] leading-5 text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    {prompt.question}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

function Recents({ onPick }: { onPick: (question: string) => void }) {
  return (
    <div className="mt-10 w-full">
      <div className="flex items-baseline justify-between gap-3 px-1">
        <h2 className="text-sm font-medium">You asked earlier</h2>
        <span className="text-xs text-muted-foreground">Kept for 30 days</span>
      </div>

      <ul className="mt-1 flex flex-col">
        {askRecents.map((recent) => (
          <li key={recent.id}>
            <button
              type="button"
              onClick={() => onPick(recent.question)}
              className="flex w-full cursor-pointer items-center gap-3 border-b border-border px-1 py-3 text-left text-sm transition-colors last:border-b-0 hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <History className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
              <span className="min-w-0 flex-1 truncate">{recent.question}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{recent.when}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Thinking() {
  return (
    <span className="flex h-4 items-end gap-[3px]" role="status" aria-label="Looking it up">
      {[0, 1, 2].map((bar) => (
        <span
          key={bar}
          className="animate-bar h-3 w-[3px] origin-bottom rounded-full bg-muted-foreground/60"
          style={{ animationDelay: `${bar * 0.16}s` }}
        />
      ))}
    </span>
  );
}

function Sources({ sources }: { sources: AskSource[] }) {
  if (sources.length === 0) return null;

  return (
    <div className="mt-4 flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] text-muted-foreground">From</span>
      {sources.map((source) => {
        const Icon = sourceIcons[source.kind];
        const className =
          "inline-flex h-6 items-center gap-1.5 rounded-full border border-border px-2 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

        return source.href ? (
          <Link key={source.label} href={source.href} className={className}>
            <Icon className="size-3" />
            {source.label}
          </Link>
        ) : (
          <button key={source.label} type="button" className={cn(className, "cursor-pointer")}>
            <Icon className="size-3" />
            {source.label}
          </button>
        );
      })}
    </div>
  );
}

function AnswerActions({ answer }: { answer: AskAnswer }) {
  const [copied, setCopied] = React.useState(false);

  const copy = () => {
    const text = [answer.lead, ...(answer.points ?? []), answer.close].filter(Boolean).join("\n\n");
    void navigator.clipboard?.writeText(text).then(() => setCopied(true));
  };

  React.useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(id);
  }, [copied]);

  return (
    <div className="mt-3 flex items-center gap-0.5 opacity-0 transition-opacity group-hover/answer:opacity-100 focus-within:opacity-100">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={copied ? "Copied" : "Copy answer"}
        title={copied ? "Copied" : "Copy answer"}
        onClick={copy}
        className="text-muted-foreground"
      >
        {copied ? <Check /> : <Copy />}
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="This helped"
        title="This helped"
        className="text-muted-foreground"
      >
        <ThumbsUp />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="This did not help"
        title="This did not help"
        className="text-muted-foreground"
      >
        <ThumbsDown />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Answer again"
        title="Answer again"
        className="text-muted-foreground"
      >
        <RefreshCw />
      </Button>
    </div>
  );
}

function TurnBlock({ turn }: { turn: Turn }) {
  return (
    <article className="animate-rise flex flex-col">
      <p className="max-w-[85%] self-end rounded-2xl bg-muted px-4 py-2.5 text-sm leading-6 whitespace-pre-wrap">
        {turn.question}
      </p>

      <div className="group/answer mt-6 flex gap-3">
        <Mascot seed="Rivervoice" size={28} className="mt-0.5" talking={!turn.answer} />

        <div className="min-w-0 flex-1">
          {turn.answer ? (
            <>
              <p className="text-[15px] leading-7">{turn.answer.lead}</p>

              {turn.answer.points ? (
                <ul className="mt-3 flex flex-col gap-2">
                  {turn.answer.points.map((point) => (
                    <li key={point} className="flex gap-2.5 text-[15px] leading-7">
                      <span aria-hidden className="mt-3 size-1 shrink-0 rounded-full bg-river" />
                      <span className="min-w-0">{point}</span>
                    </li>
                  ))}
                </ul>
              ) : null}

              {turn.answer.close ? (
                <p className="mt-3 text-[15px] leading-7 text-muted-foreground">
                  {turn.answer.close}
                </p>
              ) : null}

              <Sources sources={turn.answer.sources} />
              <AnswerActions answer={turn.answer} />
            </>
          ) : (
            <div className="flex h-7 items-center">
              <Thinking />
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

export function AskWorkspace() {
  const [turns, setTurns] = React.useState<Turn[]>([]);
  const bottom = React.useRef<HTMLDivElement>(null);
  const timers = React.useRef<ReturnType<typeof setTimeout>[]>([]);

  React.useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const busy = turns.some((turn) => turn.answer === null);

  const ask = (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || busy) return;

    const id = `t${turns.length}-${trimmed.length}`;
    setTurns((current) => [...current, { id, question: trimmed, answer: null }]);

    timers.current.push(
      setTimeout(() => {
        setTurns((current) =>
          current.map((turn) => (turn.id === id ? { ...turn, answer: answerFor(trimmed) } : turn)),
        );
      }, 900),
    );
  };

  React.useEffect(() => {
    if (turns.length === 0) return;
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns]);

  const started = turns.length > 0;

  return (
    <div className="flex min-h-0 w-full flex-col">
      <header className="flex h-10 shrink-0 items-center gap-2 px-1">
        <Sparkles className="size-4 text-muted-foreground" strokeWidth={1.75} />
        <span className="text-sm font-medium">Ask Rivervoice</span>

        {started ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTurns([])}
            className="ml-auto text-muted-foreground"
          >
            <Plus data-icon="inline-start" />
            New question
          </Button>
        ) : null}
      </header>

      {started ? (
        <div className="mx-auto w-full max-w-3xl min-w-0 px-2">
          <div className="flex flex-col gap-10 pt-6 pb-4">
            {turns.map((turn) => (
              <TurnBlock key={turn.id} turn={turn} />
            ))}
          </div>

          <div ref={bottom} className="sticky bottom-0">
            <div aria-hidden className="h-6 bg-gradient-to-t from-card to-transparent" />
            <div className="bg-card pb-2">
              <AskComposer rows={2} onSubmit={ask} placeholder="Ask a follow-up" busy={busy} />
            </div>
          </div>
        </div>
      ) : (
        <section className="mx-auto flex w-full max-w-2xl min-w-0 flex-col items-center justify-center px-2 py-10 sm:min-h-[68svh]">
          <Mascot seed="Rivervoice" size={44} className="opacity-90" />

          <h1 className="mt-5 text-center font-serif text-3xl leading-tight font-light tracking-tight sm:text-4xl">
            What do you want to know?
          </h1>

          <p className="mt-2.5 max-w-md text-center text-sm leading-6 text-muted-foreground">
            Anything about how Rivervoice works — a setting you are unsure of, a step you are stuck
            on, what something costs. Ask it the way you would ask a person.
          </p>

          <div className="mt-7 w-full">
            <AskComposer
              onSubmit={ask}
              placeholder="How do I…?"
              hint={HINT}
              autoFocus
              busy={busy}
            />
          </div>

          <Suggestions onPick={ask} />
          <Recents onPick={ask} />

          <p className="mt-8 text-[13px] text-muted-foreground">
            Still stuck?{" "}
            <button
              type="button"
              className="cursor-pointer text-foreground underline underline-offset-4 transition-colors hover:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              Send it to a human
            </button>
          </p>
        </section>
      )}
    </div>
  );
}
