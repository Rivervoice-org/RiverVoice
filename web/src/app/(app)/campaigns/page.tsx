import { CampaignEmpty } from "@/components/dashboard/campaign-empty";
import { PageHeader } from "@/components/dashboard/page-header";

export const metadata = { title: "Outbound campaigns" };

export default function CampaignsPage() {
  return (
    <>
      <PageHeader
        title="Outbound campaigns"
        description="Lists your agents work through, and what came back."
      />

      <div className="my-auto w-full">
        <CampaignEmpty />
      </div>
    </>
  );
}
