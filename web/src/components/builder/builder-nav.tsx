import { Braces, CircleCheck, Settings, Type, Wrench } from "lucide-react";

import { cn } from "@/lib/utils";

const tabs = [
  { label: "Instructions", icon: Type, active: true },
  { label: "Variables", icon: Braces },
  { label: "Tools", icon: Wrench },
  { label: "Settings", icon: Settings },
  { label: "Tests", icon: CircleCheck },
];

/** Same row metrics as the app sidebar: 32px tall, 14px label, 4px indent. */
export function BuilderNav() {
  return (
    <nav className="hidden w-52 shrink-0 flex-col gap-px px-1.5 py-3 md:flex">
      {tabs.map((tab) => (
        <button
          key={tab.label}
          type="button"
          aria-current={tab.active ? "page" : undefined}
          className={cn(
            "group/row flex h-8 w-full cursor-pointer items-center gap-2.5 rounded-md px-2 text-left text-sm",
            "text-foreground transition-colors hover:bg-accent",
            "focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
            tab.active && "bg-accent font-medium",
          )}
        >
          <tab.icon
            className={cn("size-4 shrink-0 text-muted-foreground", tab.active && "text-foreground")}
            strokeWidth={1.75}
          />
          <span className="truncate leading-5">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
