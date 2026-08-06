import {
  BookOpen,
  Bot,
  ChartLine,
  ChevronsUpDown,
  Code,
  CreditCard,
  FileText,
  House,
  type LucideIcon,
  Megaphone,
  Phone,
  PhoneIncoming,
  Search,
  Settings,
  Sparkles,
  Waves,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type NavItem = { label: string; icon: LucideIcon; badge?: string; active?: boolean };

const home: NavItem = { label: "Home", icon: House, active: true };

const sections: { title: string; items: NavItem[] }[] = [
  {
    title: "Build",
    items: [
      { label: "Agents", icon: Bot },
      { label: "Knowledge base", icon: BookOpen },
      { label: "Phone numbers", icon: Phone },
    ],
  },
  {
    title: "Deploy",
    items: [
      { label: "Inbound calls", icon: PhoneIncoming, badge: "3" },
      { label: "Outbound campaigns", icon: Megaphone },
      { label: "Deploy with code", icon: Code },
    ],
  },
  {
    title: "Monitor",
    items: [{ label: "Agent analytics", icon: ChartLine }],
  },
];

const footerNav: NavItem[] = [
  { label: "Settings", icon: Settings },
  { label: "Pricing", icon: CreditCard },
  { label: "Documentation", icon: FileText },
];

/** One 32px Notion row: icon, label, and an optional badge. */
function Row({ icon: Icon, label, active, badge, collapsed }: NavItem & { collapsed?: boolean }) {
  return (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? label : undefined}
      title={collapsed ? label : undefined}
      className={cn(
        "group/row flex h-8 w-full items-center gap-2.5 rounded-md text-left text-sm",
        "text-foreground transition-colors hover:bg-accent",
        "focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
        collapsed ? "justify-center px-0" : "px-2",
        active && "bg-accent font-medium",
      )}
    >
      <Icon
        className={cn("size-4 shrink-0 text-muted-foreground", active && "text-foreground")}
        strokeWidth={1.75}
      />
      {collapsed ? null : (
        <>
          {/* leading-5 keeps descenders (the g in "Agents") inside the clipped box */}
          <span className="truncate leading-5">{label}</span>
          {badge ? (
            <span className="ml-auto shrink-0 font-mono text-[11px] text-muted-foreground tabular-nums">
              {badge}
            </span>
          ) : null}
        </>
      )}
    </button>
  );
}

/* Flush left with the row icons, not the row labels. */
function SectionHeader({ title, collapsed }: { title: string; collapsed?: boolean }) {
  if (collapsed) {
    return <div aria-hidden className="mx-2 my-1.5 h-px bg-border" />;
  }
  return (
    <div className="flex h-7 items-center px-2">
      <span className="truncate text-xs leading-5 font-semibold text-muted-foreground">
        {title}
      </span>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="panel hidden h-full w-60 shrink-0 flex-col overflow-hidden md:flex">
      {/* Workspace */}
      <div className="p-1.5 pb-0">
        <button
          type="button"
          className="group/ws flex h-10 w-full items-center gap-2.5 rounded-md px-2 text-left transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <span className="flex size-4 shrink-0 items-center justify-center rounded-[5px] bg-foreground text-background">
            <Waves className="size-2.5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">Rivervoice</span>
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/ws:opacity-100" />
        </button>
      </div>

      {/* Scrollable nav — everything above the pinned footer */}
      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pt-1 pb-2 [scrollbar-width:thin]">
        <div className="flex flex-col gap-px">
          <Row icon={Search} label="Search" />
          <Row icon={Sparkles} label="Ask Rivervoice" />
        </div>

        <div className="mt-3 flex flex-col gap-px">
          <Row {...home} />
        </div>

        {sections.map((section) => (
          <div key={section.title} className="mt-4 flex flex-col gap-px">
            <SectionHeader title={section.title} />
            {section.items.map((item) => (
              <Row key={item.label} {...item} />
            ))}
          </div>
        ))}
      </div>

      {/* Pinned footer */}
      <div className="border-t border-border p-1.5">
        <div className="flex flex-col gap-px">
          {footerNav.map((item) => (
            <Row key={item.label} {...item} />
          ))}
        </div>

        <button
          type="button"
          className="group/user mt-1 flex h-11 w-full items-center gap-2 rounded-md px-2 text-left transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <Avatar size="sm">
            <AvatarFallback className="bg-river-tint text-[11px] text-river">PN</AvatarFallback>
          </Avatar>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm">Pavan</span>
            <span className="block truncate text-[11px] text-muted-foreground">
              Free plan · 4 seats
            </span>
          </span>
          <span className="shrink-0 text-[11px] font-medium text-river opacity-0 transition-opacity group-hover/user:opacity-100">
            Upgrade
          </span>
        </button>
      </div>
    </aside>
  );
}
