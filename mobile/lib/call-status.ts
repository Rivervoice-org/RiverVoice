import { useEffect, useState } from "react";
import { CallStatus } from "@/lib/webrtc/ferry-call";

/**
 * How much of a conversation there is to show. Lives here beside
 * `callStatusToPhase`, the only thing that produces one.
 */
export enum TranscriptPhase {
  Connecting = "connecting",
  Live = "live",
  Ended = "ended",
}

export function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function callStatusToPhase(status: CallStatus): TranscriptPhase {
  switch (status) {
    case CallStatus.Connected:
      return TranscriptPhase.Live;
    case CallStatus.Ended:
    case CallStatus.Error:
      return TranscriptPhase.Ended;
    default:
      return TranscriptPhase.Connecting;
  }
}

/**
 * Seconds since `connectedAt`, re-derived from that timestamp on a 1s tick
 * rather than counted locally — so it reads correctly on first render
 * whenever this mounts, not just for a component that was there for the
 * whole call. `connectedAt` null (not connected, or connected before this
 * mounted and already ended) reads as 0.
 */
export function useElapsedSeconds(connectedAt: number | null): number {
  const [, tick] = useState(0);

  useEffect(() => {
    if (connectedAt === null) return;
    const interval = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(interval);
  }, [connectedAt]);

  return connectedAt === null
    ? 0
    : Math.max(0, Math.floor((Date.now() - connectedAt) / 1000));
}

export function callStatusLabel(status: CallStatus, duration: number): string {
  switch (status) {
    case CallStatus.Idle:
    case CallStatus.Connecting:
      return "Calling…";
    case CallStatus.Ringing:
      return "Ringing…";
    case CallStatus.Connected:
      return formatDuration(duration);
    case CallStatus.Error:
      return "Call failed";
    case CallStatus.Ended:
      return "Call ended";
  }
}
