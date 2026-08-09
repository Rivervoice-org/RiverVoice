import { redirect } from "next/navigation";

import { MascotNavIcon } from "@/mascots";
import { MobileNav, Sidebar } from "@/components/dashboard/sidebar";
import { Splash } from "@/components/dashboard/splash";
import { UserProvider } from "@/providers/user-provider";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const me = await getSession();
  if (!me) redirect("/sign-in");

  return (
    <UserProvider me={me}>
      <div className="flex h-svh gap-2 overflow-hidden bg-canvas p-2">
        <Splash />
        <Sidebar agentsMark={<MascotNavIcon size={18} />} />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
          <MobileNav agentsMark={<MascotNavIcon size={18} />} />

          <main className="panel flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-x-hidden overflow-y-auto p-3 *:shrink-0 sm:p-4">
            {children}
          </main>
        </div>
      </div>
    </UserProvider>
  );
}
