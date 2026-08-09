import { redirect } from "next/navigation";

import { AgentBoard } from "@/components/dashboard/agent-board";
import { AgentComposer } from "@/components/dashboard/agent-composer";
import { AgentTemplates } from "@/components/dashboard/agent-templates";
import { CreateAgentDialog } from "@/components/dashboard/create-agent-dialog";
import { PageHeader } from "@/components/dashboard/page-header";
import { getAgents, getAgentTemplates } from "@/lib/agents/server";
import { readPositive, toSearchParams } from "@/lib/search-params";
import type { AgentPage as Board, AgentTemplate } from "@/lib/agents/types";

export const metadata = { title: "Agents" };

/** Per-user data. Stated outright rather than left to infer from the cookie read. */
export const dynamic = "force-dynamic";

const DEFAULT_SIZE = 10;

export default async function AgentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = toSearchParams(await searchParams);

  const search = (params.get("q") ?? "").trim();
  // Capped at harbor's own ceiling, so a url asking for ten thousand rows gets
  // a page rather than a 400.
  const size = readPositive(params.get("size"), DEFAULT_SIZE, 100);

  const page = readPositive(params.get("page"), 1);

  let board: Board = { agents: [], total: 0, limit: size, offset: 0 };
  let templates: AgentTemplate[] = [];
  let failed = false;

  // Neither is worth failing the page over: a harbor that is down leaves the
  // sections empty and says so.
  const [agentsResult, templatesResult] = await Promise.allSettled([
    getAgents({ search, limit: size, offset: (page - 1) * size }),
    getAgentTemplates(),
  ]);

  if (agentsResult.status === "fulfilled") {
    board = agentsResult.value;
  } else {
    failed = true;
    console.error("agents page: could not read agents", agentsResult.reason);
  }

  if (templatesResult.status === "fulfilled") {
    templates = templatesResult.value;
  } else {
    failed = true;
    console.error("agents page: could not read templates", templatesResult.reason);
  }

  // Deleting the last agent on the last page leaves the url pointing past the
  // end: harbor answers with no rows while the total still says there are some,
  // and the board would claim it is empty while the pager counts "21–20 of 20".
  //
  // Not while harbor is unreachable, though — a total of zero is then a failure
  // to count rather than an answer, and rewriting the url over a blip is worse
  // than the wrong page number.
  const lastPage = Math.max(1, Math.ceil(board.total / size));
  if (!failed && page > lastPage) {
    const corrected = new URLSearchParams(params);
    if (lastPage > 1) corrected.set("page", String(lastPage));
    else corrected.delete("page");

    const query = corrected.toString();
    redirect(query ? `/agents?${query}` : "/agents");
  }

  return (
    <>
      <PageHeader
        title="Agents"
        description="Everyone who answers your phones — live, paused, and still in draft."
        action={<CreateAgentDialog />}
      />

      <AgentComposer />
      <AgentBoard
        agents={board.agents}
        total={board.total}
        page={page}
        size={size}
        search={search}
        failed={failed}
      />
      <AgentTemplates templates={templates} failed={failed} />
    </>
  );
}
