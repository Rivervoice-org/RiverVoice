import { View } from "react-native";
import { Text } from "./ui/text";
import { cn } from "@/lib/utils";

const INITIALS_TINTS = [
  { bg: "bg-river-tint", text: "text-river" },
  { bg: "bg-amber-tint", text: "text-amber" },
  { bg: "bg-green-tint", text: "text-green" },
] as const;

/** First + last word's initial (or the first two letters of a single word). */
function initialsOf(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0];
  if (!first) return "";
  if (words.length === 1) return first.slice(0, 2).toUpperCase();
  // Always in bounds (words.length >= 2 here) — the fallback is unreachable.
  const last = words[words.length - 1] ?? "";
  return `${first[0]}${last[0]}`.toUpperCase();
}

/** Deterministic tint per name, so the same person always gets the same color. */
function hashTint(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  // Always in bounds (modulo the tuple's own length) — the fallback is unreachable.
  return INITIALS_TINTS[Math.abs(hash) % INITIALS_TINTS.length] ?? INITIALS_TINTS[0];
}

/** A person's avatar when there's no picture to show — initials on a tinted
 * circle, the same idea as Google/Slack contact avatars. */
export function InitialsAvatar({ name, size = 32 }: { name: string; size?: number }) {
  const initials = initialsOf(name);
  const tint = hashTint(name);
  return (
    <View
      className={cn("items-center justify-center rounded-full", tint.bg)}
      style={{ width: size, height: size }}
    >
      <Text className={cn("font-semibold", tint.text)} style={{ fontSize: size * 0.38 }}>
        {initials}
      </Text>
    </View>
  );
}
