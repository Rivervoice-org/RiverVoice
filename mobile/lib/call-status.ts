import { TranscriptPhase } from "@/components/Transcript";
import { CallStatus } from "@/lib/webrtc/ferry-call";

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
