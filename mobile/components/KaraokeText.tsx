import { memo } from "react";
import { Text } from "@/components/ui/text";

/**
 * Renders `text` word by word, highlighting whichever one is at
 * `activeIndex` — the word being spoken by TTS on the other end *right
 * now*, not just "this line is playing somewhere". No accent color: the
 * active word gets a subtle `foreground`-tinted highlighter box (the same
 * neutral ink token used for all emphasis on this screen — see
 * `CallControl`'s active-state fill), already-spoken words are
 * `text-foreground`, and words not reached yet fall back to
 * `text-muted-foreground` — the same three tones this app already uses for
 * text hierarchy everywhere else. Falls back to plain text once playback
 * has finished (`activeIndex` is -1) or hasn't started.
 */
export const KaraokeText = memo(function KaraokeText({
  text,
  activeIndex,
}: {
  text: string;
  activeIndex: number;
}) {
  if (activeIndex < 0) {
    return <Text className="mt-1 text-sm leading-snug text-foreground">{text}</Text>;
  }

  const words = text.split(/(\s+)/); // keep whitespace as its own tokens
  let wordIndex = -1;

  return (
    <Text className="mt-1 text-sm leading-snug">
      {words.map((token, i) => {
        const isWhitespace = /^\s+$/.test(token);
        if (!isWhitespace) wordIndex += 1;
        const isActive = !isWhitespace && wordIndex === activeIndex;
        const isSpoken = !isWhitespace && wordIndex < activeIndex;
        return (
          <Text
            key={i}
            className={
              isActive
                ? "bg-foreground/10 font-semibold text-foreground"
                : isSpoken
                  ? "text-foreground"
                  : "text-muted-foreground"
            }
          >
            {token}
          </Text>
        );
      })}
    </Text>
  );
});
