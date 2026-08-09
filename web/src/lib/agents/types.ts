/**
 * Mirrors harbor's generated rows. The one seam sqlc cannot close: change a
 * column and this has to follow, or the browser reads undefined.
 */

export type AgentStatus = "draft" | "live";
export type VersionState = "draft" | "committed";
export type ToolKind = "api" | "validator" | "mock";
export type ToolTrigger = "start" | "during" | "end";

/** A card on the roster. Mirrors harbor's ListAgentTemplatesRow. */
export type AgentTemplate = {
  id: string;
  name: string;
  purpose: string;
  mascot: string | null;
  /** Empty if the template was seeded without one. */
  category: string;
};

/** A row on the agents board. */
export type AgentSummary = {
  id: string;
  name: string;
  mascot: string | null;
  purpose: string;
  status: AgentStatus;
  editedAt: string;
  /** Empty once the person who last edited it has left the org. */
  editedBy: string;
};

/**
 * One page of the board. `total` counts the whole match rather than the page,
 * which is what the pager needs in order to know how many pages there are.
 */
export type AgentPage = {
  agents: AgentSummary[];
  total: number;
  limit: number;
  offset: number;
};

export type ApiToolConfig = {
  method: string;
  url: string;
  headers: Record<string, string>;
  params: Record<string, string>;
  body: string;
  auth?: string;
  responseTemplate: string;
  mappings: Record<string, string>;
  maxWait: number;
  failureMessage: string;
  keepAvailable: boolean;
};

export type MockToolConfig = {
  response: string;
  status: number;
  delaySeconds: number;
  realUrl: string;
  responseTemplate: string;
  mappings: Record<string, string>;
  keepAvailable: boolean;
};

export type ValidatorToolConfig = {
  field: string;
  rule: string;
  onInvalid: string;
};

type ToolBase = {
  id: string;
  name: string;
  description: string;
  trigger: ToolTrigger;
  enabled: boolean;
  position: number;
  updatedAt: string;
};

/** Discriminated on kind, so `tool.kind === "api"` narrows the config. */
export type Tool =
  | (ToolBase & { kind: "api"; config: ApiToolConfig })
  | (ToolBase & { kind: "mock"; config: MockToolConfig })
  | (ToolBase & { kind: "validator"; config: ValidatorToolConfig });

/** An agent at one version: identity, that version's settings, and the tools. */
export type Agent = {
  id: string;
  name: string;
  mascot: string | null;
  purpose: string;
  status: AgentStatus;
  /** Empty until the first publish. */
  liveVersionId: string;
  createdAt: string;

  versionId: string;
  version: number;
  state: VersionState;

  greeting: string;
  instructions: string;

  ttsProvider: string;
  ttsModel: string;
  voice: string;
  speed: number;
  pitch: number;

  llmProvider: string;
  llmModel: string;
  creativity: number;
  knowledgeOnly: boolean;

  sttProvider: string;
  sttModel: string;
  interruptible: boolean;
  replyDelay: number;
  noiseFilter: boolean;

  switchLanguage: boolean;
  languages: string[];
  startingLanguage: string;
  switchAfter: number;
  indicNumerals: boolean;

  backgroundSound: string;
  backgroundVolume: number;

  nudgeQuietCallers: boolean;
  hangupAfterNudges: boolean;
  leaveVoicemail: boolean;
  voicemailMessage: string;
  maxCallMinutes: number;

  systemTools: string[];

  editedAt: string;
  editedBy: string;

  tools: Tool[];
};
