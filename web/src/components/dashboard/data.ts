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

export type Agent = {
  name: string;
  number: string;
  calls: number;
  status: "live" | "paused" | "draft";
  purpose: string;
  voice: string;
  languages: string[];
  model: string;
  avgDuration: string;
  resolved: number;
  edited: string;
  owner: string;
};

export const agents: Agent[] = [
  {
    name: "Front Desk",
    number: "+91 80 4711 0288",
    calls: 612,
    status: "live",
    purpose: "Books appointments and answers opening hours.",
    voice: "Meera",
    languages: ["Kannada", "Hindi", "English"],
    model: "Sarvam STT · Twilio",
    avgDuration: "2:41",
    resolved: 0.81,
    edited: "2 days ago",
    owner: "pavan@rivervoice.app",
  },
  {
    name: "Billing",
    number: "+1 628 555 0100",
    calls: 388,
    status: "live",
    purpose: "Explains invoices and takes payment details.",
    voice: "Arden",
    languages: ["English"],
    model: "Sarvam STT · Twilio",
    avgDuration: "4:12",
    resolved: 0.64,
    edited: "6 hours ago",
    owner: "pavan@rivervoice.app",
  },
  {
    name: "Order status",
    number: "+44 20 7946 0800",
    calls: 284,
    status: "live",
    purpose: "Looks up a shipment and reads back the ETA.",
    voice: "Nell",
    languages: ["English"],
    model: "Sarvam STT · Twilio",
    avgDuration: "1:58",
    resolved: 0.92,
    edited: "yesterday",
    owner: "pavan@rivervoice.app",
  },
  {
    name: "After hours",
    number: "Not assigned",
    calls: 0,
    status: "paused",
    purpose: "Takes a message when the office is closed.",
    voice: "Meera",
    languages: ["English"],
    model: "Sarvam STT · Twilio",
    avgDuration: "—",
    resolved: 0,
    edited: "3 weeks ago",
    owner: "pavan@rivervoice.app",
  },
  {
    name: "Renewals",
    number: "Not assigned",
    calls: 0,
    status: "draft",
    purpose: "Calls out to customers whose plan lapses this month.",
    voice: "Arden",
    languages: ["English", "Hindi"],
    model: "Sarvam STT · Twilio",
    avgDuration: "—",
    resolved: 0,
    edited: "just now",
    owner: "pavan@rivervoice.app",
  },
];

/** Starting points on the Agents page. Each one draws its own mascot. */
export type TemplateCategory = "Booking" | "Reminders" | "Recovery" | "Lead qualification";

export type AgentTemplate = {
  name: string;
  description: string;
  category: TemplateCategory;
};

export const templateCategories: TemplateCategory[] = [
  "Booking",
  "Reminders",
  "Recovery",
  "Lead qualification",
];

export const agentTemplates: AgentTemplate[] = [
  {
    name: "Appointment management",
    description: "Turns calls into bookings, reschedules, and confirmations without a handoff.",
    category: "Booking",
  },
  {
    name: "Sales discovery",
    description: "Asks the three questions that decide whether sales should call back.",
    category: "Lead qualification",
  },
  {
    name: "EMI collection",
    description: "Runs payment reminders and walks customers through settling an instalment.",
    category: "Recovery",
  },
  {
    name: "Front desk",
    description: "Greets callers, reads back opening hours, and takes a message after hours.",
    category: "Booking",
  },
  {
    name: "Renewal nudge",
    description: "Calls customers whose plan lapses this month and offers to extend it.",
    category: "Reminders",
  },
  {
    name: "Order status",
    description: "Looks up a shipment and reads back where it is and when it lands.",
    category: "Reminders",
  },
];

export const usage = {
  minutes: { used: 8420, included: 12000 },
  transcription: { used: 6310, included: 12000 },
  renewsOn: "1 September",
};
