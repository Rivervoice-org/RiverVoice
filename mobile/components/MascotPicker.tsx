import { useEffect, useState } from "react";
import { Image, InteractionManager, Pressable, View } from "react-native";
import { Pencil } from "lucide-react-native";
import { Mascot } from "@/components/Mascot";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { useThemeColors } from "@/lib/theme";
import {
  DEFAULT_MASCOT_REF,
  MASCOT_STYLE_IDS,
  SEEDS,
  avatarUrl,
  mascotRef,
  mascotStyle,
  type MascotStyleId,
} from "@/lib/mascots";

const FACE_SIZE = 40;

function faceRefs(style: MascotStyleId) {
  return SEEDS.map((seed) => mascotRef(style, seed));
}

/** Prefetch so the grid's faces are in Image's cache before they render. */
function warmFaces(style: MascotStyleId) {
  for (const ref of faceRefs(style)) Image.prefetch(avatarUrl(ref, FACE_SIZE));
}

interface MascotPickerProps {
  /** A mascot ref ("style:seed"), or undefined for the default face. */
  value?: string;
  onSelect: (ref: string | undefined) => void;
  /** Trigger avatar size. */
  size?: number;
}

/**
 * The web's mascot picker, reworked for touch: a dialog of faces instead of a
 * hover popover. Faces are drawn locally and cached, so the grid warms in the
 * background and every open after the first is instant.
 */
export function MascotPicker({ value, onSelect, size = 96 }: MascotPickerProps) {
  const colors = useThemeColors();
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<MascotStyleId>("notionists");

  // Defer the grid's prefetch until the dialog has animated in, so the first
  // paint of the sheet is never held up by a burst of network calls.
  useEffect(() => {
    if (!open) return;
    const handle = InteractionManager.runAfterInteractions(() => warmFaces(style));
    const timer = setTimeout(() => warmFaces(style), 300);
    return () => {
      handle.cancel();
      clearTimeout(timer);
    };
  }, [open, style]);

  // Pre-warm the visible style once on mount, so the very first open is fast.
  useEffect(() => {
    const handle = InteractionManager.runAfterInteractions(() => warmFaces(style));
    return () => handle.cancel();
  }, [style]);

  const meta = mascotStyle(style).meta;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Choose mascot"
          className="relative active:opacity-80"
          hitSlop={8}
        >
          <Mascot ref={value ?? DEFAULT_MASCOT_REF} size={size} />
          <View className="absolute right-0 bottom-0 h-8 w-8 items-center justify-center rounded-full border-2 border-canvas bg-foreground">
            <Pencil size={13} strokeWidth={2} color={colors.onInk} />
          </View>
        </Pressable>
      </DialogTrigger>

      <DialogContent className="max-w-[360px]">
        <View className="gap-4 pt-1">
          <View>
            <DialogTitle>Mascot</DialogTitle>
            <DialogDescription className="mt-1">
              Pick a face.
            </DialogDescription>
          </View>

          <View className="flex-row gap-2">
            {MASCOT_STYLE_IDS.map((id) => {
              const selected = id === style;
              return (
                <Pressable
                  key={id}
                  onPress={() => setStyle(id)}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 active:opacity-80",
                    selected ? "border-foreground bg-foreground" : "border-border bg-card"
                  )}
                >
                  <Text
                    className={cn(
                      "text-[13px] font-medium",
                      selected ? "text-primary-foreground" : "text-foreground"
                    )}
                  >
                    {mascotStyle(id).label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View className="flex-row flex-wrap gap-2.5">
            {SEEDS.map((seed) => {
              const ref = mascotRef(style, seed);
              const selected = value === ref;
              return (
                <Pressable
                  key={ref}
                  onPress={() => {
                    onSelect(ref);
                    setOpen(false);
                  }}
                  accessibilityLabel={seed}
                  className={cn(
                    "rounded-full p-0.5",
                    selected && "border border-foreground"
                  )}
                >
                  <Mascot ref={ref} size={FACE_SIZE} />
                </Pressable>
              );
            })}
          </View>

          {value && (
            <Pressable
              onPress={() => {
                onSelect(undefined);
                setOpen(false);
              }}
              className="items-start"
            >
              <Text variant="muted" className="text-[13px] underline">
                Use the default face
              </Text>
            </Pressable>
          )}

          <Text variant="muted" className="text-[11px]">
            {meta.title}
            {meta.license ? ` · ${meta.license.name}` : ""}
          </Text>
        </View>
      </DialogContent>
    </Dialog>
  );
}
