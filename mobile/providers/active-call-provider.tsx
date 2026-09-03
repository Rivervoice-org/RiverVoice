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
import {
  endCallNotification,
  initCallNotifications,
  syncCallNotification,
} from "@/lib/call-notification";

/**
 * Owns the one `useFerryCall` instance for the whole app, above the
 * navigation stack — so leaving `/in-call` for any other screen no longer
 * ends the call. `CallMinimizedPill`, rendered here so it floats above
 * every screen, is what lets the user get back to it.
 */
export function ActiveCallProvider({ children }: { children: ReactNode }) {
  const call = useFerryCall();
  const { startCall: ferryStartCall, end: ferryEnd } = call;
  const [meta, setMeta] = useState<ActiveCallMeta | null>(null);
  // Timestamp rather than a locally-incremented counter: CallStatusLine and
  // CallMinimizedPill mount/unmount independently as the user minimizes/
  // reopens, so a setInterval-driven counter local to either would reset to
  // 0:00 every time — this stays right regardless of which one's mounted.
  const [connectedAt, setConnectedAt] = useState<number | null>(null);

  const startCall = useCallback(
    (nextMeta: ActiveCallMeta) => {
      setMeta(nextMeta);
      ferryStartCall(nextMeta.agentId ?? "", nextMeta.phone);
    },
    [ferryStartCall],
  );

  const end = useCallback(() => {
    ferryEnd();
    setMeta(null);
    setConnectedAt(null);
  }, [ferryEnd]);

  // A call can end (or connect) without anyone calling `end()`/`startCall`
  // from here — ferry hanging up, the other leg failing, WebRTC's transport
  // dying or coming up. Watched here rather than left to whichever screen
  // happens to be mounted, so the pill/timer stay right regardless.
  useEffect(() => {
    if (call.status === CallStatus.Connected) {
      setConnectedAt((prev) => prev ?? Date.now());
    } else if (call.status === CallStatus.Ended) {
      setMeta(null);
      setConnectedAt(null);
    }
  }, [call.status]);

  // One-time setup: channel, Android foreground-service registration, and
  // the tap-to-return handler for whenever the app's JS is already alive.
  useEffect(() => initCallNotifications(), []);

  // Keeps the Android ongoing-call notification/foreground service in sync
  // with the call, and ends it the moment `meta` clears.
  useEffect(() => {
    if (meta) {
      void syncCallNotification(meta, call.status, connectedAt);
    } else {
      void endCallNotification();
    }
  }, [meta, call.status, connectedAt]);

  const contextValue = useMemo(
    () => ({
      status: call.status,
      conversation: call.conversation,
      interimCaption: call.interimCaption,
      error: call.error,
      isMuted: call.isMuted,
      audioDevices: call.audioDevices,
      activeAudioDevice: call.activeAudioDevice,
      meta,
      connectedAt,
      startCall,
      end,
      toggleMute: call.toggleMute,
      chooseAudioRoute: call.chooseAudioRoute,
    }),
    [
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
