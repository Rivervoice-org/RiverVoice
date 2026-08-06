/** Mock data for the dashboard UI. No backend is wired up yet. */

export type CallOutcome = "resolved" | "transferred" | "voicemail" | "dropped";

export type Call = {
  id: string;
  caller: string;
  region: string;
  agent: string;
  language: string;
  duration: string;
  outcome: CallOutcome;
  time: string;
  sentiment: number;
};

export const liveCall = {
  caller: "+91 98450 22118",
  region: "Bengaluru, IN",
  agent: "Front Desk",
  language: "Kannada → English",
  elapsed: "02:14",
  transcript: [
    { speaker: "Caller", line: "ನಾನು ನಾಳೆ ಬೆಳಿಗ್ಗೆ ಬರಬಹುದೇ?" },
    { speaker: "Agent", line: "Yes — 9:30 or 11:00 tomorrow both work. Which suits you?" },
    { speaker: "Caller", line: "ಒಂಬತ್ತೂವರೆ ಸರಿ." },
  ],
};

export const waitingCalls = [
  { caller: "+1 415 220 9931", agent: "Billing", waited: "0:08" },
  { caller: "+91 80 4711 0290", agent: "Front Desk", waited: "0:03" },
];

export const metrics = [
  {
    label: "Calls answered",
    value: "1,284",
    delta: "+12%",
    trend: "up" as const,
    caption: "vs. last week",
    series: [22, 28, 24, 34, 30, 41, 38, 46, 44, 52, 49, 58],
  },
  {
    label: "Median handle time",
    value: "2:41",
    delta: "−18s",
    trend: "up" as const,
    caption: "vs. last week",
    series: [48, 46, 47, 43, 44, 40, 38, 39, 35, 34, 32, 30],
  },
  {
    label: "Resolved without a human",
    value: "76%",
    delta: "+4 pts",
    trend: "up" as const,
    caption: "vs. last week",
    series: [30, 33, 31, 38, 36, 42, 44, 41, 48, 52, 55, 58],
  },
  {
    label: "Missed calls",
    value: "9",
    delta: "+3",
    trend: "down" as const,
    caption: "vs. last week",
    series: [12, 9, 10, 7, 8, 6, 7, 5, 6, 8, 7, 9],
  },
];

export const calls: Call[] = [
  {
    id: "c_9f21",
    caller: "+91 99001 47210",
    region: "Bengaluru, IN",
    agent: "Front Desk",
    language: "Kannada",
    duration: "3:12",
    outcome: "resolved",
    time: "11:42",
    sentiment: 0.82,
  },
  {
    id: "c_9f18",
    caller: "+1 628 555 0147",
    region: "San Francisco, US",
    agent: "Billing",
    language: "English",
    duration: "5:48",
    outcome: "transferred",
    time: "11:29",
    sentiment: 0.41,
  },
  {
    id: "c_9f11",
    caller: "+91 80 4711 0290",
    region: "Bengaluru, IN",
    agent: "Front Desk",
    language: "Hindi",
    duration: "1:04",
    outcome: "voicemail",
    time: "11:16",
    sentiment: 0.55,
  },
  {
    id: "c_9f07",
    caller: "+44 20 7946 0812",
    region: "London, UK",
    agent: "Order status",
    language: "English",
    duration: "2:33",
    outcome: "resolved",
    time: "10:58",
    sentiment: 0.9,
  },
  {
    id: "c_9ef4",
    caller: "+91 97400 33184",
    region: "Mysuru, IN",
    agent: "Front Desk",
    language: "Kannada",
    duration: "0:21",
    outcome: "dropped",
    time: "10:47",
    sentiment: 0.18,
  },
  {
    id: "c_9ee9",
    caller: "+1 917 555 0163",
    region: "New York, US",
    agent: "Billing",
    language: "English",
    duration: "4:07",
    outcome: "resolved",
    time: "10:31",
    sentiment: 0.71,
  },
];

export const agents = [
  { name: "Front Desk", number: "+91 80 4711 0288", calls: 612, status: "live" as const },
  { name: "Billing", number: "+1 628 555 0100", calls: 388, status: "live" as const },
  { name: "Order status", number: "+44 20 7946 0800", calls: 284, status: "live" as const },
  { name: "After hours", number: "Not assigned", calls: 0, status: "paused" as const },
];

export const usage = {
  minutes: { used: 8420, included: 12000 },
  transcription: { used: 6310, included: 12000 },
  renewsOn: "1 September",
};
