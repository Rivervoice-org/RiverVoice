"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Braces, CircleCheck, Settings, Type, Wrench } from "lucide-react";

import { cn } from "@/lib/utils";

const tabs = [
  { label: "Instructions", icon: Type, segment: "" },
  { label: "Variables", icon: Braces, segment: "variables" },
  { label: "Tools", icon: Wrench },
  { label: "Settings", icon: Settings },
  { label: "Tests", icon: CircleCheck },
];

/** Same row metrics as the app sidebar: 32px tall, 14px label, 4px indent. */
export function BuilderNav({ agentId }: { agentId: string }) {
  const pathname = usePathname();
  const base = `/build-agent/${agentId}`;

  return (
    <nav className="hidden w-52 shrink-0 flex-col gap-px px-1.5 py-3 md:flex">
      {tabs.map((tab) => {
        const href =
          tab.segment === undefined ? undefined : `${base}/${tab.segment}`.replace(/\/$/, "");
        const active = href ? pathname === href : false;

        const className = cn(
          "group/row flex h-8 w-full cursor-pointer items-center gap-2.5 rounded-md px-2 text-left text-sm",
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
