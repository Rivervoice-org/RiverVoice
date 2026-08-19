import { CallOutcome, type CallRowItem } from "@/components/CallRow";

export const RECENT_CALLS: CallRowItem[] = [
  {
    id: "1",
    number: "+91 98765 43210",
    agent: "Front Desk",
    language: "Hindi → English",
    duration: "3:42",
    outcome: CallOutcome.Resolved,
    time: "2m ago",
  },
  {
    id: "2",
    number: "+91 87654 32109",
    agent: "Billing",
    language: "Tamil → English",
    duration: "1:15",
    outcome: CallOutcome.Transferred,
    time: "18m ago",
  },
  {
    id: "3",
    number: "+91 76543 21098",
    agent: "Front Desk",
    language: "Bengali → English",
    duration: "5:08",
    outcome: CallOutcome.Resolved,
    time: "1h ago",
  },
  {
    id: "4",
    number: "+91 65432 10987",
    agent: null,
    language: "Hindi → English",
    duration: "0:32",
    outcome: CallOutcome.Missed,
    time: "3h ago",
  },
  {
    id: "5",
    number: "+91 54321 09876",
    agent: "Order Status",
    language: "Gujarati → English",
    duration: "2:11",
    outcome: CallOutcome.Resolved,
    time: "Yesterday",
  },
];

export const ACTIVE_AGENTS = [
  { id: "1", name: "Front Desk", status: "live", calls: 847 },
  { id: "2", name: "Billing", status: "live", calls: 312 },
  { id: "3", name: "Order Status", status: "paused", calls: 156 },
];
