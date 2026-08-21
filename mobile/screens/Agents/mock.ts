export type AgentStatus = "live" | "paused" | "draft";

export type Agent = {
  id: string;
  name: string;
  purpose: string;
  status: AgentStatus;
  calls: number;
  numbers: string[];
  editedAt: string;
  editedBy: string;
  inputLang: string;
  outputLang: string;
  mode: string;
  gender: string;
  mascot?: string;
};

export const AGENTS: Agent[] = [
  {
    id: "1",
    name: "Front Desk",
    purpose: "Greets callers and routes them to the right team",
    status: "live",
    calls: 847,
    numbers: ["+1 888 799 9666", "+1 888 799 9667"],
    editedAt: "2h ago",
    editedBy: "Pavan",
    inputLang: "hi",
    outputLang: "en",
    mode: "formal",
    gender: "female",
  },
  {
    id: "2",
    name: "Billing",
    purpose: "Answers billing and payment questions",
    status: "live",
    calls: 312,
    numbers: ["+1 888 799 9668"],
    editedAt: "1d ago",
    editedBy: "Pavan",
    inputLang: "hi",
    outputLang: "en",
    mode: "modern-colloquial",
    gender: "male",
  },
  {
    id: "3",
    name: "Order Status",
    purpose: "Tracks orders and shares live status updates",
    status: "paused",
    calls: 156,
    numbers: ["+1 888 799 9669"],
    editedAt: "3d ago",
    editedBy: "Meera",
    inputLang: "te",
    outputLang: "en",
    mode: "classic-colloquial",
    gender: "neutral",
  },
  {
    id: "4",
    name: "Collections",
    purpose: "Recovers overdue invoices, politely",
    status: "draft",
    calls: 0,
    numbers: [],
    editedAt: "1w ago",
    editedBy: "Meera",
    inputLang: "ta",
    outputLang: "en",
    mode: "formal",
    gender: "male",
  },
  {
    id: "5",
    name: "Support",
    purpose: "Handles returns and product questions",
    status: "draft",
    calls: 0,
    numbers: [],
    editedAt: "2w ago",
    editedBy: "Pavan",
    inputLang: "kn",
    outputLang: "en",
    mode: "code-mixed",
    gender: "female",
  },
];
