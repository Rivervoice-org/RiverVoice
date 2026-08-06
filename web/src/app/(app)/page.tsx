import { HomeAgents } from "@/components/dashboard/home-agents";
import { HomeCalls } from "@/components/dashboard/home-calls";
import { HomeUsage } from "@/components/dashboard/home-usage";

export const metadata = { title: "Home" };

export default function HomePage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl min-w-0 flex-col gap-10 px-2 py-6">
      <div className="animate-rise">
        <h1 className="text-2xl leading-tight font-semibold tracking-[-0.02em] sm:text-[28px]">
          Good afternoon, Pavan
        </h1>

        <p className="mt-1.5 text-sm text-muted-foreground">Wednesday, 6 August</p>
      </div>

      <HomeUsage />
      <HomeAgents />
      <HomeCalls />
    </div>
  );
}
