import { useState } from "react";
import { Pressable } from "react-native";
import { Keyboard } from "lucide-react-native";
import { DialPadSheet } from "@/components/DialPadSheet";

/**
 * The floating dial-pad trigger, self-contained. Its open/close state used to
 * live in CallScreen, which meant every tap re-rendered the whole screen —
 * including a several-hundred-row contact SectionList — just to toggle a
 * sheet. Owning the state here means opening/closing only re-renders this
 * small subtree, not the list.
 */
export function DialFab() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        className="absolute bottom-6 right-5 h-14 w-14 items-center justify-center rounded-full bg-foreground shadow-lift active:opacity-80"
      >
        <Keyboard size={22} strokeWidth={1.75} color="#fcfbf9" />
      </Pressable>

      <DialPadSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}
