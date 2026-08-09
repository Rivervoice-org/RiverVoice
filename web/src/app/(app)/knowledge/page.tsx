import { KnowledgeEmpty } from "@/components/dashboard/knowledge-empty";
import { PageHeader } from "@/components/dashboard/page-header";

export const metadata = { title: "Knowledge base" };

export default function KnowledgePage() {
  return (
    <>
      <PageHeader
        title="Knowledge base"
        description="The sources your agents are allowed to answer from."
      />

      <div className="my-auto w-full">
        <KnowledgeEmpty />
      </div>
    </>
  );
}
