import { CallOutcome, type CallRowItem } from "@/components/CallRow";

export const CALL_HISTORY: CallRowItem[] = [
  {
    id: "h1",
    name: "Priya Sharma",
    number: "+91 98765 43210",
    fromNumber: "+1 888 799 9666",
    agent: "Front Desk",
    language: "Hindi → English",
    duration: "2:15",
    outcome: CallOutcome.Resolved,
    time: "3 days ago",
  },
  {
    id: "h2",
    name: "Priya Sharma",
    number: "+91 98765 43210",
    fromNumber: "+1 888 799 9666",
    agent: "Billing",
    language: "Hindi → English",
    duration: "4:01",
    outcome: CallOutcome.Transferred,
    time: "2 weeks ago",
  },
  {
    id: "h3",
    name: "Priya Sharma",
    number: "+91 98765 43210",
    fromNumber: "+1 888 799 9666",
    agent: null,
    language: "Hindi → English",
    duration: "1:02",
    outcome: CallOutcome.Missed,
    time: "1 month ago",
  },
];

export type TranscriptEntry = {
  speaker: "caller" | "agent";
  name: string;
  time: string;
  original: string;
  translated: string | null;
};

export const WAVEFORM = [
  10, 16, 24, 14, 30, 20, 36, 26, 42, 22, 32, 24, 14, 28, 18, 34, 26, 40,
  22, 16, 30, 38, 24, 18, 32, 14, 26, 36, 20, 28, 16, 22, 32, 24, 38, 30,
  18, 26, 14, 20, 28, 22, 34, 26, 16, 30, 20, 38, 24, 14, 28, 18, 32, 22,
  26, 36, 20, 30, 24, 16,
];

export const TRANSCRIPT: TranscriptEntry[] = [
  {
    speaker: "caller",
    name: "Priya Sharma",
    time: "0:00",
    original: "नमस्ते, मुझे अपना बिलिंग विवरण चाहिए।",
    translated: "Hello, I need my billing details.",
  },
  {
    speaker: "agent",
    name: "Front Desk",
    time: "0:04",
    original: "Namaste! I'd be happy to help with your billing details.",
    translated: null,
  },
  {
    speaker: "caller",
    name: "Priya Sharma",
    time: "0:10",
    original: "मुझे लगता है मुझे इस महीने ज़्यादा चार्ज किया गया है।",
    translated: "I think I was overcharged this month.",
  },
  {
    speaker: "agent",
    name: "Front Desk",
    time: "0:14",
    original: "Let me pull up your recent charges and take a look.",
    translated: null,
  },
  {
    speaker: "caller",
    name: "Priya Sharma",
    time: "0:19",
    original: "ठीक है, धन्यवाद।",
    translated: "Okay, thank you.",
  },
  {
    speaker: "agent",
    name: "Front Desk",
    time: "0:21",
    original: "I see the issue — a duplicate charge on the 12th. I'll refund it now.",
    translated: null,
  },
];
