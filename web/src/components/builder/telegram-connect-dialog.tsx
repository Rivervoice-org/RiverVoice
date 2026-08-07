"use client";

import * as React from "react";
import { useForm } from "@tanstack/react-form";
import { Check, Copy, Dices, ExternalLink, Unlink } from "lucide-react";
import QRCode from "qrcode";
import { animals, uniqueNamesGenerator } from "unique-names-generator";
import { z } from "zod";

import { Player } from "@/motion/player";
import { telegramScenes } from "@/motion/walkthroughs/telegram";
import { Step, TextField } from "@/components/builder/tool-form";
import { chatLabel, getMe, pollChats, sendMessage, type Bot, type Chat } from "@/lib/telegram";
import type { Agent } from "@/lib/agents/types";
import { Mascot, mascotDataUri } from "@/mascots";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// BotFather hands back <bot id>:<secret>.
const tokenSchema = z.object({
  token: z
    .string()
    .trim()
    .regex(/^\d{8,10}:[A-Za-z0-9_-]{35}$/, "That does not look like a BotFather token"),
});

const MAX_USERNAME = 32;

// Usernames are unique across all of Telegram and cannot be checked before
// BotFather rejects one, so an animal widens the pool and rerolling is cheap.
function suggestUsername(name: string, seed: string) {
  // Seeded, so the server and the browser render the same suggestion.
  const animal = uniqueNamesGenerator({ dictionaries: [animals], seed })
    .toLowerCase()
    .replace(/[^a-z]/g, "");

  const suffix = `_${animal}_bot`;
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, MAX_USERNAME - suffix.length);

  return `${base}${suffix}`;
}

function CopyField({
  label,
  value,
  onReroll,
}: {
  label: string;
  value: string;
  onReroll?: () => void;
}) {
  const [copied, setCopied] = React.useState(false);

  const copy = () => {
    navigator.clipboard?.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-[13px] text-muted-foreground sm:w-28">{label}</span>
      <code className="min-w-0 flex-1 truncate rounded-lg bg-muted/60 px-3 py-1.5 font-mono text-xs">
        {value}
      </code>
      {onReroll ? (
        <Button
          variant="ghost"
          size="icon-sm"
          type="button"
          aria-label="Suggest another"
          onClick={onReroll}
          className="shrink-0 text-muted-foreground"
        >
          <Dices />
        </Button>
      ) : null}
      <Button
        variant="ghost"
        size="icon-sm"
        type="button"
        aria-label={`Copy ${label}`}
        onClick={copy}
        className="shrink-0 text-muted-foreground"
      >
        {copied ? <Check /> : <Copy />}
      </Button>
    </div>
  );
}

function Done({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 text-[13px]">
      <Check className="size-4 shrink-0 text-muted-foreground" />
      {children}
    </div>
  );
}

function InviteQr({ link }: { link: string }) {
  const [svg, setSvg] = React.useState<string>();

  React.useEffect(() => {
    QRCode.toString(link, { type: "svg", margin: 1, color: { light: "#0000" } })
      // Drawn in currentColor so it follows the theme rather than staying black.
      .then((markup) => setSvg(markup.replaceAll("#000000", "currentColor")));
  }, [link]);

  return (
    <div
      role="img"
      aria-label={`QR code linking to ${link}`}
      className="mx-auto flex size-36 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/40 p-2 *:size-full sm:mx-0"
      dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
    />
  );
}

export function TelegramConnectDialog({
  agent,
  open,
  onOpenChange,
}: {
  agent: Agent;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [roll, setRoll] = React.useState(0);
  const [bot, setBot] = React.useState<Bot>();
  const [token, setToken] = React.useState<string>();
  const [chats, setChats] = React.useState<Chat[]>([]);
  const [sent, setSent] = React.useState<number>();
  const [error, setError] = React.useState<string>();

  const username = suggestUsername(agent.name, `${agent.id}-${roll}`);
  const inviteLink = `https://t.me/${bot?.username ?? username}?startgroup=rv_${agent.id}`;

  const form = useForm({
    defaultValues: { token: "" },
    validators: { onChange: tokenSchema },
    onSubmit: async ({ value }) => {
      setError(undefined);
      try {
        setBot(await getMe(value.token));
        setToken(value.token);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not reach Telegram");
      }
    },
  });

  // Stands in for the webhook: whatever the bot has heard from, it can post to.
  React.useEffect(() => {
    if (!token) return;

    let offset = 0;
    let stopped = false;

    const tick = async () => {
      try {
        const result = await pollChats(token, offset);
        offset = result.offset;
        if (!stopped && result.chats.length > 0) {
          setChats((current) => [
            ...current,
            ...result.chats.filter((chat) => !current.some((seen) => seen.id === chat.id)),
          ]);
        }
      } catch {
        // A revoked token or a network blip; the next tick tries again.
      }
    };

    const timer = window.setInterval(tick, 2000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [token]);

  const test = async (chat: Chat) => {
    if (!token) return;
    setError(undefined);
    try {
      await sendMessage(token, chat.id, `${agent.name} here. This is a test message.`);
      setSent(chat.id);
      window.setTimeout(() => setSent(undefined), 2000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not send");
    }
  };

  const disconnect = () => {
    setBot(undefined);
    setToken(undefined);
    setChats([]);
    setError(undefined);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[86svh] flex-col gap-0 rounded-2xl p-0 sm:max-w-xl">
        <header className="shrink-0 border-b border-border px-4 py-5 sm:px-6">
          <DialogTitle className="text-base font-medium">Message on Telegram</DialogTitle>
          <DialogDescription className="mt-1 text-[13px]">
            {agent.name} gets its own bot, so follow-ups arrive under its name and face.
          </DialogDescription>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-7 overflow-y-auto px-4 py-6 sm:px-6">
          <Player
            scenes={telegramScenes}
            script={{
              agentName: agent.name,
              avatar: mascotDataUri(agent.mascot ?? agent.name, 128),
              // Live, so rerolling the dice changes what the walkthrough types.
              username: bot?.username ?? username,
              group: chats.find((chat) => chat.type !== "private")?.title ?? "Reception team",
              summary: ["Booked Priya for 9:30", "tomorrow. Kannada call."],
            }}
          />

          <Step
            n={1}
            title="Create the bot"
            hint="Telegram only lets a person create a bot, so this part happens in your app."
          >
            <div className="surface flex items-center gap-3 p-3">
              <Mascot seed={agent.mascot ?? agent.name} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium">{agent.name}</p>
                <p className="truncate text-[13px] text-muted-foreground">{agent.purpose}</p>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <CopyField label="Name" value={agent.name} />

              <CopyField
                label="Username"
                value={username}
                onReroll={() => setRoll((current) => current + 1)}
              />
            </div>

            <Button
              variant="outline"
              size="lg"
              type="button"
              nativeButton={false}
              className="w-fit rounded-full px-4"
              render={<a href="https://t.me/botfather" target="_blank" rel="noreferrer noopener" />}
            >
              Open BotFather
              <ExternalLink data-icon="inline-end" />
            </Button>
          </Step>

          <Step
            n={2}
            title="Paste the token"
            hint="BotFather sends it back the moment you pick a username."
          >
            {bot ? (
              <Done>
                Connected as <span className="font-mono">@{bot.username}</span>, shown as{" "}
                <span className="font-medium">{bot.first_name}</span>.
              </Done>
            ) : (
              <form
                noValidate
                className="flex items-start gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  form.handleSubmit();
                }}
              >
                <form.Field name="token">
                  {(field) => (
                    <div className="min-w-0 flex-1">
                      <TextField
                        field={field}
                        type="password"
                        autoComplete="off"
                        placeholder="8123456789:AAHk9..."
                        aria-label="Bot token"
                        className="h-9 rounded-lg font-mono text-xs"
                      />
                    </div>
                  )}
                </form.Field>

                <form.Subscribe>
                  {(state) => (
                    <Button
                      size="lg"
                      type="submit"
                      disabled={!state.canSubmit || state.isSubmitting}
                    >
                      {state.isSubmitting ? "Checking…" : "Connect"}
                    </Button>
                  )}
                </form.Subscribe>
              </form>
            )}
          </Step>

          <Step
            n={3}
            title="Add it to a group"
            hint="Scan this on the phone that runs Telegram, then pick the group to post in."
          >
            <div
              className={cn(
                "flex flex-wrap items-center gap-4",
                !bot && "pointer-events-none opacity-40",
              )}
            >
              <InviteQr link={inviteLink} />

              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <code className="truncate rounded-lg bg-muted/60 px-3 py-1.5 font-mono text-xs">
                  {inviteLink}
                </code>
                <p className="text-[13px] text-muted-foreground">
                  You have to be an admin of the group to add a bot to it. Sending it any message
                  works too.
                </p>
              </div>
            </div>

            {bot ? (
              <div className="surface divide-y divide-border overflow-hidden">
                {chats.length === 0 ? (
                  <p className="px-4 py-3 text-[13px] text-muted-foreground">
                    Waiting for the bot to be added somewhere…
                  </p>
                ) : (
                  chats.map((chat) => (
                    <div key={chat.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium">{chatLabel(chat)}</p>
                        <p className="font-mono text-[11px] text-muted-foreground">
                          {chat.type} · {chat.id}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        className="shrink-0 rounded-full px-3"
                        onClick={() => test(chat)}
                      >
                        {sent === chat.id ? <Check data-icon="inline-start" /> : null}
                        {sent === chat.id ? "Sent" : "Send a test"}
                      </Button>
                    </div>
                  ))
                )}
              </div>
            ) : null}

            {error ? (
              <p role="alert" className="text-[13px] text-destructive">
                {error}
              </p>
            ) : null}
          </Step>
        </div>

        <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-4 py-4 sm:px-6">
          {bot ? (
            <Button
              variant="ghost"
              size="lg"
              type="button"
              onClick={disconnect}
              className="mr-auto text-muted-foreground"
            >
              <Unlink data-icon="inline-start" />
              Disconnect
            </Button>
          ) : null}
          <Button size="lg" type="button" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
