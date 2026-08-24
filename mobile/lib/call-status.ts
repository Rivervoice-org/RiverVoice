import { TranscriptPhase } from "@/components/Transcript";
import { CallStatus } from "@/lib/ws/ferry-call";

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
