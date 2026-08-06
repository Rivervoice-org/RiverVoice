import { CallsTable } from "@/components/dashboard/calls-table";
import { LiveCall } from "@/components/dashboard/live-call";
import { Metrics } from "@/components/dashboard/metrics";
import { PageHeader } from "@/components/dashboard/page-header";
import { RightRail } from "@/components/dashboard/right-rail";

export const metadata = { title: "Home" };

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        eyebrow="Wednesday, 6 August"
        title="Good afternoon, Pavan"
        description="Three agents are answering. One call is on the line right now."
      />

      <LiveCall />
      <Metrics />

      <div className="grid min-w-0 items-stretch gap-3 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <CallsTable />
        <RightRail />
      </div>
    </>
  );
}
