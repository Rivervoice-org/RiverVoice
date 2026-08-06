import { CallsTable } from "@/components/dashboard/calls-table";
import { LiveCall } from "@/components/dashboard/live-call";
import { Metrics } from "@/components/dashboard/metrics";
import { RightRail } from "@/components/dashboard/right-rail";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";

export default function DashboardPage() {
  return (
    <div className="flex h-svh gap-3 overflow-hidden bg-canvas p-3">
      <Sidebar />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
        <Topbar />

        <main className="panel flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-x-hidden overflow-y-auto p-4 [scrollbar-width:thin]">
          {/* Page header — Notion's quiet title block */}
          <div className="animate-rise px-1 pt-2 pb-1">
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground">
              Wednesday, 6 August
            </p>
            <h1 className="mt-1 font-serif text-3xl leading-tight font-light tracking-tight sm:text-4xl">
              Good afternoon, Pavan
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Three agents are answering. One call is on the line right now.
            </p>
          </div>

          <LiveCall />
          <Metrics />

          <div className="grid min-w-0 items-stretch gap-3 xl:grid-cols-[minmax(0,1fr)_20rem]">
            <CallsTable />
            <RightRail />
          </div>
        </main>
      </div>
    </div>
  );
}
