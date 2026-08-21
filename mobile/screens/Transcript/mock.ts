export type TranscriptEntry = {
  speaker: "caller" | "agent";
  name: string;
  time: string;
  original: string;
  translated: string | null;
};

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
