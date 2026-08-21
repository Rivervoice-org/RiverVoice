/** Stand-ins for persisted data, now that the API is gone. */

import type { Me } from "@/lib/auth/types";
import type { Agent, AgentSummary, AgentTemplate } from "@/lib/agents/types";

export const mockMe: Me = {
  user: {
    id: "u1",
    name: "Demo User",
    email: "demo@rivervoice.app",
    phone: "+919845022118",
    role: "owner",
  },
  org: { id: "o1", name: "Demo Org" },
};

export const mockAgentSummary: AgentSummary = {
  id: "a1",
  name: "Front desk",
  mascot: null,
  purpose: "Answers calls and books appointments",
  status: "draft",
  editedAt: new Date().toISOString(),
  editedBy: mockMe.user.name,
};

export const mockAgent: Agent = {
  id: mockAgentSummary.id,
  name: mockAgentSummary.name,
  mascot: mockAgentSummary.mascot,
  purpose: mockAgentSummary.purpose,
  status: mockAgentSummary.status,
  liveVersionId: "",
  createdAt: mockAgentSummary.editedAt,

  versionId: "v1",
  version: 1,
  state: "draft",

  greeting: "Hi, thanks for calling — how can I help?",
  instructions: "Be friendly and concise. Book appointments when asked.",

  ttsProvider: "sarvam",
  ttsModel: "default",
  voice: "meera",
  speed: 1,
  pitch: 0,

  llmProvider: "openrouter",
  llmModel: "default",
  creativity: 0.3,
  knowledgeOnly: false,

  sttProvider: "deepgram",
  sttModel: "nova-2",
  interruptible: true,
  replyDelay: 0.3,
  noiseFilter: true,

  switchLanguage: false,
  languages: ["en"],
  startingLanguage: "en",
  switchAfter: 0,
  indicNumerals: false,

  backgroundSound: "none",
  backgroundVolume: 0,

  nudgeQuietCallers: false,
  hangupAfterNudges: false,
  leaveVoicemail: false,
  voicemailMessage: "",
  maxCallMinutes: 10,

  systemTools: [],

  editedAt: mockAgentSummary.editedAt,
  editedBy: mockAgentSummary.editedBy,

  tools: [],
};

export const mockAgentTemplate: AgentTemplate = {
  id: "t1",
  name: "Front desk",
  purpose: "Answers calls and books appointments",
  mascot: null,
  category: "Reception",
};
