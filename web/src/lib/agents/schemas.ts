import { z } from "zod";

// Mirrors harbor's rules, so the browser catches what the server would reject.
export const createAgentSchema = z.object({
  name: z.string().trim().min(2, "Give the agent a name").max(100),
  mascot: z.string().max(100),
});

export type CreateAgentValues = z.infer<typeof createAgentSchema>;
