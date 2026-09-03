import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  ActiveCallContext,
  type ActiveCallMeta,
} from "@/state/active-call/context";
import { useFerryCall } from "@/hooks/use-ferry-call";
import { CallStatus } from "@/lib/webrtc/ferry-call";
import { CallMinimizedPill } from "@/components/CallMinimizedPill";

/**
 * Owns the one `useFerryCall` instance for the whole app, above the
 * navigation stack — so leaving `/in-call` for any other screen (back
 * button, tapping elsewhere) no longer tears the call down the way it did
 * when the hook lived inside that screen. `InCall` now just reads this
 * context instead of calling `useFerryCall` itself, and `CallMinimizedPill`
 * (rendered here, so it floats above every screen) is what lets the user get
 * back to it.
 */
export function ActiveCallProvider({ children }: { children: ReactNode }) {
  const call = useFerryCall();
  const [meta, setMeta] = useState<ActiveCallMeta | null>(null);
  // The moment `status` first reached `Connected`, not when `startCall` was
  // invoked — mirrors what `callStatusLabel` actually counts (Connecting/
  // Ringing don't tick). A timestamp rather than a locally-incremented
  // counter on purpose: both `CallStatusLine` (on `/in-call`) and
  // `CallMinimizedPill` mount and unmount independently as the user
  // minimizes/reopens, and a `setInterval`-driven counter local to either
  // one would reset to 0:00 every time. Deriving elapsed time from a shared
  // timestamp instead means whichever one is on screen always shows the
  // real duration, not "time since I last mounted."
  const [connectedAt, setConnectedAt] = useState<number | null>(null);
  // Set only by `startMockCall` (InCall's `USE_MOCK_CALL` path) — overrides
  // `call.status` below so the pill reads "Connected" without a real
  // `FerryCall`/WebRTC/ferry call ever happening. null the rest of the time,
  // so real calls are entirely unaffected.
  const [mockStatus, setMockStatus] = useState<CallStatus | null>(null);

  const startCall = useCallback(
    (nextMeta: ActiveCallMeta) => {
      setMeta(nextMeta);
      call.startCall(nextMeta.agentId ?? "", nextMeta.phone);
    },
    [call.startCall],
  );

  // Dev-only: seeds `meta`/`connectedAt` (what the pill and `useElapsedSeconds`
  // read) without calling the real `FerryCall` — for exercising the pill/
  // minimize UX from InCall's `USE_MOCK_CALL` flag, no ferry/WebRTC/network
  // involved.
  const startMockCall = useCallback((nextMeta: ActiveCallMeta) => {
    // Guarded the same way `createCall` guards real calls (use-ferry-call.ts)
    // — idempotent, so re-running this on re-entry from the pill (or
    // StrictMode's double-invoke) doesn't reset an already-running mock's
    // `connectedAt`.
    setMeta((prev) => prev ?? nextMeta);
    setConnectedAt((prev) => prev ?? Date.now());
    setMockStatus((prev) => prev ?? CallStatus.Connected);
  }, []);

  const end = useCallback(() => {
    call.end();
    setMeta(null);
    setConnectedAt(null);
    setMockStatus(null);
  }, [call.end]);

  // A call can end (or connect) without anyone calling `end()`/`startCall`
  // from here — ferry hanging up, the other leg failing, WebRTC's transport
  // itself dying or coming up. Watched here rather than left to whichever
  // screen happens to be mounted, so the pill/timer stay right even if the
  // user isn't looking at `/in-call` when it happens.
  useEffect(() => {
    if (call.status === CallStatus.Connected) {
      setConnectedAt((prev) => prev ?? Date.now());
    } else if (call.status === CallStatus.Ended) {
      setMeta(null);
      setConnectedAt(null);
    }
  }, [call.status]);

  const contextValue = useMemo(
    () => ({
      status: mockStatus ?? call.status,
      conversation: call.conversation,
      interimCaption: call.interimCaption,
      error: call.error,
      isMuted: call.isMuted,
      audioDevices: call.audioDevices,
      activeAudioDevice: call.activeAudioDevice,
      meta,
      connectedAt,
      startCall,
      startMockCall,
      end,
      toggleMute: call.toggleMute,
      chooseAudioRoute: call.chooseAudioRoute,
    }),
    [
      mockStatus,
      call.status,
      call.conversation,
      call.interimCaption,
      call.error,
      call.isMuted,
      call.audioDevices,
      call.activeAudioDevice,
      meta,
      connectedAt,
      startCall,
      startMockCall,
      end,
      call.toggleMute,
      call.chooseAudioRoute,
    ],
  );

  return (
    <ActiveCallContext.Provider value={contextValue}>
      {children}
      <CallMinimizedPill />
    </ActiveCallContext.Provider>
  );
}
