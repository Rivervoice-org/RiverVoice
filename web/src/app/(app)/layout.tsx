import { Sidebar } from "@/components/dashboard/sidebar";
import { Splash } from "@/components/dashboard/splash";

/** The app shell: splash, rail, and the one scrolling content panel. */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex h-svh gap-2 overflow-hidden bg-canvas p-2">
      <Splash />
      <Sidebar />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
        {/* Sections must not shrink: this column scrolls, and a flex item that
            shrinks below its content gets clipped when it also hides overflow. */}
        <main className="panel flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-x-hidden overflow-y-auto p-4 *:shrink-0">
          {children}
        </main>
      </div>
    </div>
  );
}
