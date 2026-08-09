/**
 * Kept apart from the hooks so a server component can prefetch into the same
 * keys the client reads. Importing them from queries.ts would pull useQuery and
 * useRouter into the server graph, which is a build error.
 */

export const agentsQueryKey = ["agents"] as const;

/** Version in the key, so switching versions is a cache hit on the way back. */
export const agentQueryKey = (id: string, version?: number) =>
  ["agents", id, version ?? "latest"] as const;

export const templatesQueryKey = ["agent-templates"] as const;
