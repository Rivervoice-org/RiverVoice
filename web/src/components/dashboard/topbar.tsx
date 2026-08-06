import { Bell, ChevronRight, Filter, Plus, Search, Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";

export function Topbar() {
  return (
    <header className="panel z-20 flex h-12 shrink-0 items-center gap-2 px-2.5">
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 text-sm">
        <span className="truncate text-muted-foreground">Workspace</span>
        <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60" />
        <span className="truncate font-medium">Overview</span>
      </nav>

      <div className="mx-2 hidden min-w-0 flex-1 justify-center md:flex">
        <button
          type="button"
          className="row-hover flex h-8 w-full max-w-sm items-center gap-2 rounded-lg border border-border px-2.5 text-sm text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <Search className="size-3.5" />
          <span className="truncate">Search calls, agents, numbers</span>
          <kbd className="ml-auto rounded border border-border px-1 font-mono text-[10px]">⌘K</kbd>
        </button>
      </div>

      <div className="ml-auto flex items-center gap-1">
        <Button variant="ghost" size="sm" className="hidden sm:inline-flex">
          <Filter data-icon="inline-start" />
          Today
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="Share">
          <Share2 />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="Notifications">
          <Bell />
        </Button>
        <Button size="sm" className="ml-1">
          <Plus data-icon="inline-start" />
          New agent
        </Button>
      </div>
    </header>
  );
}
