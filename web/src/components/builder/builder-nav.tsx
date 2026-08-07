"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Braces, CircleCheck, Settings, Type, Wrench } from "lucide-react";

import { cn } from "@/lib/utils";

const tabs = [
  { label: "Instructions", icon: Type, segment: "" },
  { label: "Variables", icon: Braces, segment: "variables" },
  { label: "Tools", icon: Wrench, segment: "tools" },
  { label: "Settings", icon: Settings, segment: "settings" },
  { label: "Tests", icon: CircleCheck },
];

/**
 * Same row metrics as the app sidebar: 32px tall, 14px label, 4px indent. Below
 * md the rail lies down into a scrolling strip above the page.
 */
export function BuilderNav({ agentId }: { agentId: string }) {
  const pathname = usePathname();
  const base = `/build-agent/${agentId}`;

  return (
    <nav className="flex shrink-0 gap-px overflow-x-auto border-b border-border px-1.5 py-1.5 md:w-52 md:flex-col md:overflow-x-visible md:border-b-0 md:py-3">
      {tabs.map((tab) => {
        const href =
          tab.segment === undefined ? undefined : `${base}/${tab.segment}`.replace(/\/$/, "");
        const active = href ? pathname === href : false;

        const className = cn(
          "group/row flex h-8 shrink-0 cursor-pointer items-center gap-2.5 rounded-md px-2 text-left text-sm md:w-full",
          "text-foreground transition-colors hover:bg-accent",
          "focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
          active && "bg-accent font-medium",
          !href && "text-muted-foreground",
        );

        const content = (
          <>
            <tab.icon
              className={cn("size-4 shrink-0 text-muted-foreground", active && "text-foreground")}
              strokeWidth={1.75}
            />
            <span className="truncate leading-5">{tab.label}</span>
          </>
        );

        return href ? (
          <Link
            key={tab.label}
            href={href}
            aria-current={active ? "page" : undefined}
            className={className}
          >
            {content}
          </Link>
        ) : (
          <button key={tab.label} type="button" className={className}>
            {content}
          </button>
        );
      })}
    </nav>
  );
}
