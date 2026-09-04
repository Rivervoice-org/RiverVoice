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
        <View className="mb-3.5 flex-row rounded-lg bg-secondary p-1">
          {[RecordingVariant.Original, RecordingVariant.Translated].map((v) => {
            const active = variant === v;
            return (
              <Pressable
                key={v}
                onPress={() => onVariantChange(v)}
                className={cn(
                  "flex-1 items-center rounded-md py-1.5",
                  // Not `shadow-float` here even though it's static elsewhere
                  // in this file — toggling a shadow-* class on/off via a
                  // conditional expression is a known NativeWind bug
                  // (nativewind/nativewind#1536, #1557, #1711, #1712):
                  // it races NativeWind's runtime CSS interop against React
                  // Navigation's context init and can throw "Couldn't find
                  // a navigation context" on unrelated screens. The
                  // background-color contrast against the track is enough
                  // to show which one's selected without it.
                  active && "bg-card",
                )}
              >
                <Text
                  className={cn(
                    "text-[12px] font-medium",
                    active ? "text-foreground" : "text-muted-foreground",
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
          className="h-10 w-10 items-center justify-center rounded-full bg-foreground active:opacity-80"
        >
          {isPlaying ? (
            <Pause
              size={16}
              strokeWidth={2}
              color={colors.onInk}
              fill={colors.onInk}
            />
          ) : (
            <Play
              size={16}
              strokeWidth={2}
              color={colors.onInk}
              fill={colors.onInk}
              style={{ marginLeft: 1.5 }}
            />
          )}
        </Pressable>
        <View className="flex-1 gap-1.5">
          <Progress value={progress} className="h-2" />
          <View className="flex-row justify-between">
            <Text font="mono" variant="muted" className="text-[11px]">
              {formatTime(positionMs)}
            </Text>
            <Text font="mono" variant="muted" className="text-[11px]">
              {formatTime(durationMs)}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}
