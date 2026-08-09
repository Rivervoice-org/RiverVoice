import { cache } from "react";

import { serverGet } from "@/lib/api-server";
import type { AgentSummary, AgentTemplate } from "@/lib/agents/types";

/**
 * Read once per request, however many components ask. React's cache dedupes
 * within a single render, so a layout and a page wanting the same roster cost
 * harbor one call rather than two.
 */

export const getAgents = cache(() => serverGet<AgentSummary[]>("/v1/agents"));

export const getAgentTemplates = cache(() => serverGet<AgentTemplate[]>("/v1/agent-templates"));
