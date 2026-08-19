import Link from "next/link";
import { redirect } from "next/navigation";
import { Waves } from "lucide-react";

import { AuthAside } from "@/components/auth/auth-aside";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (await getSession()) redirect("/home");

  return (
    <div className="min-h-svh bg-canvas p-2">
      <div className="grid min-h-[calc(100svh-1rem)] gap-2 lg:grid-cols-2">
        <div className="panel flex flex-col p-6 sm:p-10">
          <Link href="/" className="inline-flex w-fit items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-md border border-border">
              <Waves className="size-3.5" strokeWidth={2} />
            </span>
            <span className="text-sm font-medium">Rivervoice</span>
          </Link>

          <main className="flex flex-1 items-center py-10">
            <div className="mx-auto w-full max-w-[24rem]">{children}</div>
          </main>

          <p className="text-[11px] text-muted-foreground">© Rivervoice · Terms · Privacy</p>
        </div>

        <AuthAside />
      </div>
    </div>
  );
}
