import { createContext } from "react";
import type { AudioDevice, CallStatus } from "@/lib/webrtc/ferry-call";
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
  creditsExhausted: boolean;
  isMuted: boolean;
  audioDevices: AudioDevice[];
  activeAudioDevice: AudioDevice;
  /** Set for the lifetime of one call, regardless of which screen (if any)
   * is mounted. Whether a call is "active" is `meta !== null`, not
   * `status` — `status` briefly outlives `end()` clearing `meta`. */
  meta: ActiveCallMeta | null;
  /** `Date.now()` from when `status` first reached `Connected`, else null —
   * `useElapsedSeconds` (lib/call-status.ts) reads from this so duration
   * survives whichever component (screen or pill) mounts/unmounts. */
  connectedAt: number | null;
  startCall: (meta: ActiveCallMeta) => void;
  end: () => void;
  toggleMute: () => void;
  chooseAudioRoute: (route: AudioDevice) => void;
}

export const ActiveCallContext = createContext<ActiveCallContextValue | null>(
  null,
);

/** `/in-call`'s route params, rebuilt from `meta` — the one place this
 * mapping lives, since both `CallMinimizedPill` (tap to return) and the
 * ongoing-call OS notification (tap to return) need to reconstruct the
 * exact same params the screen was originally launched with. */
export function inCallRouteParams(meta: ActiveCallMeta): {
  name: string;
  phone: string;
  agentId: string;
  agentName: string;
  agentMascot: string;
} {
  return {
    name: meta.contactName ?? "",
    phone: meta.phone,
    agentId: meta.agentId ?? "",
    agentName: meta.agentName,
    agentMascot: meta.agentMascot ?? "",
  };
}
