import { createContext } from "react";
import { AudioDevice, CallStatus } from "@/lib/webrtc/ferry-call";
import type { ConversationLine } from "@/hooks/use-ferry-call";

/** Everything InCall needs to redraw itself when re-entered from the
 * minimized pill — the same shape `/in-call`'s route params already carry,
 * kept here too so the pill can rebuild those params without the screen
 * having to be mounted. */
export type ActiveCallMeta = {
  contactName?: string | undefined;
  phone: string;
  agentId?: string | undefined;
  agentName: string;
  agentMascot?: string | undefined;
};

export interface ActiveCallContextValue {
  status: CallStatus;
  conversation: ConversationLine[];
  interimCaption: string;
  error: string | null;
  isMuted: boolean;
  audioDevices: AudioDevice[];
  activeAudioDevice: AudioDevice;
  /** Set for the lifetime of one call — from `startCall` until it ends,
   * regardless of which screen (if any) is currently mounted. Whether a
   * call is "active" for pill/minimize purposes is `meta !== null`, not
   * `status`, since `status` briefly outlives `end()` clearing `meta`. */
  meta: ActiveCallMeta | null;
  /** `Date.now()` from when `status` first reached `Connected`, or null
   * before/after that — the shared source of truth `useElapsedSeconds`
   * (lib/call-status.ts) reads from, so elapsed time survives whichever
   * component (the screen or the pill) happens to mount/unmount. */
  connectedAt: number | null;
  startCall: (meta: ActiveCallMeta) => void;
  /** Dev-only: seeds `meta`/`connectedAt`/`status` as if a call were live,
   * without touching the real `FerryCall` — no ferry/WebRTC/network call.
   * What InCall's `USE_MOCK_CALL` flag uses to exercise the minimized pill. */
  startMockCall: (meta: ActiveCallMeta) => void;
  end: () => void;
  toggleMute: () => void;
  chooseAudioRoute: (route: AudioDevice) => void;
}

export const ActiveCallContext = createContext<ActiveCallContextValue | null>(
  null,
);
