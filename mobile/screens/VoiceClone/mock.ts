export type VoiceCloneStatus = "ready" | "processing";

export type VoiceClone = {
  id: string;
  name: string;
  status: VoiceCloneStatus;
  duration: string;
  createdAt: string;
};

export const VOICE_CLONES: VoiceClone[] = [
  {
    id: "1",
    name: "My voice",
    status: "ready",
    duration: "0:42",
    createdAt: "2026-08-12",
  },
  {
    id: "2",
    name: "Founder intro",
    status: "ready",
    duration: "1:05",
    createdAt: "2026-08-18",
  },
  {
    id: "3",
    name: "Support lead",
    status: "processing",
    duration: "0:38",
    createdAt: "2026-08-23",
  },
];
