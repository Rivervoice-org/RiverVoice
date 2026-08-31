import { Pressable, View } from "react-native";
import { Pause, Play } from "lucide-react-native";
import { Progress } from "@/components/ui/progress";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { useThemeColors } from "@/lib/theme";
import { RecordingVariant } from "@/lib/calls/use-recording-player";

function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Play/pause, a progress bar, and — only when the call actually has a
 * translated recording — an Original/Translated segmented toggle. Renders
 * nothing if there's no audio at all, so callers can mount it unconditionally.
 */
export function RecordingPlayer({
  hasAudio,
  hasTranslated,
  variant,
  onVariantChange,
  isPlaying,
  positionMs,
  durationMs,
  onToggle,
}: {
  hasAudio: boolean;
  hasTranslated: boolean;
  variant: RecordingVariant;
  onVariantChange: (variant: RecordingVariant) => void;
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
  onToggle: () => void;
}) {
  const colors = useThemeColors();

  if (!hasAudio) {
    return (
      <Text variant="muted" className="mt-2 text-xs">
        No recording for this call
      </Text>
    );
  }

  const progress = durationMs > 0 ? (positionMs / durationMs) * 100 : 0;

  return (
    <View className="mt-2">
      {hasTranslated ? (
        <View className="mb-3 flex-row gap-1.5">
          {[RecordingVariant.Original, RecordingVariant.Translated].map((v) => {
            const active = variant === v;
            return (
              <Pressable
                key={v}
                onPress={() => onVariantChange(v)}
                className={cn(
                  "flex-1 items-center rounded-lg border py-1.5",
                  active
                    ? "border-foreground bg-foreground"
                    : "border-border bg-transparent",
                )}
              >
                <Text
                  className={cn(
                    "text-[12px] font-medium",
                    active
                      ? "text-primary-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {v === RecordingVariant.Original ? "Original" : "Translated"}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <View className="flex-row items-center gap-3">
        <Pressable
          onPress={onToggle}
          className="h-9 w-9 items-center justify-center rounded-full bg-foreground active:opacity-80"
        >
          {isPlaying ? (
            <Pause
              size={15}
              strokeWidth={2}
              color={colors.onInk}
              fill={colors.onInk}
            />
          ) : (
            <Play
              size={15}
              strokeWidth={2}
              color={colors.onInk}
              fill={colors.onInk}
            />
          )}
        </Pressable>
        <View className="flex-1">
          <Progress value={progress} />
        </View>
        <Text font="mono" variant="muted" className="text-[11px]">
          {formatTime(positionMs)} / {formatTime(durationMs)}
        </Text>
      </View>
    </View>
  );
}
