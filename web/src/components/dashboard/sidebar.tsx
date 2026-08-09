"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronsUpDown,
  CreditCard,
  FileText,
  House,
  type LucideIcon,
  ChevronsLeft,
  ChevronsRight,
  Coins,
  LogOut,
  Menu,
  Monitor,
  Moon,
  MoonStar,
  Phone,
  PhoneIncoming,
  Search,
  Settings,
  Sun,
  Sparkles,
  Users,
  Waves,
} from "lucide-react";

import { AnalyticsIcon, CampaignIcon, DeployCodeIcon, KnowledgeIcon } from "@/components/icons";
import { usage } from "@/components/dashboard/data";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useSignOut } from "@/lib/auth/queries";
import { useUserContext } from "@/hooks/use-user-context";
import { originOf, useThemeTransition } from "@/lib/use-theme-transition";
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  icon?: LucideIcon | React.ComponentType<{ className?: string; strokeWidth?: number }>;
  badge?: string;
  href?: string;
  /** Rendered on the server and passed in, so DiceBear stays out of this bundle. */
  mark?: React.ReactNode;
};

const home: NavItem = { label: "Home", icon: House, href: "/home" };

const sections: { title: string; items: NavItem[] }[] = [
  {
    title: "Build",
    items: [
      { label: "Agents", href: "/agents" },
      { label: "Knowledge base", icon: KnowledgeIcon, href: "/knowledge" },
      { label: "Phone numbers", icon: Phone },
    ],
  },
  {
    title: "Deploy",
    items: [
      { label: "Inbound calls", icon: PhoneIncoming, badge: "3" },
      { label: "Outbound campaigns", icon: CampaignIcon, href: "/campaigns" },
      { label: "Deploy with code", icon: DeployCodeIcon },
    ],
  },
  {
    title: "Monitor",
    items: [{ label: "Agent analytics", icon: AnalyticsIcon }],
  },
];

const footerNav: NavItem[] = [
  { label: "Pricing", icon: CreditCard },
  { label: "Documentation", icon: FileText },
];

/** One 32px Notion row: icon, label, and an optional badge. Routed items
    render as links; the rest are inert buttons until their page exists. */
function Row({
  icon: Icon,
  label,
  badge,
  href,
  mark,
  collapsed,
}: NavItem & { collapsed?: boolean }) {
  const pathname = usePathname();
  const active = href ? pathname === href : false;

  const shared = {
    "aria-current": active ? ("page" as const) : undefined,
    "aria-label": collapsed ? label : undefined,
    title: collapsed ? label : undefined,
    className: cn(
      "group/row flex h-8 w-full cursor-pointer items-center gap-2.5 rounded-md text-left text-sm",
      "text-foreground transition-colors hover:bg-accent",
      "focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
      collapsed ? "justify-center px-0" : "px-2",
      active && "bg-accent font-medium",
    ),
  };

  const content = (
    <>
      {mark ??
        (Icon ? (
          <Icon
            className={cn("size-4 shrink-0 text-muted-foreground", active && "text-foreground")}
            strokeWidth={1.75}
          />
        ) : null)}
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
    </>
  );

  return href ? (
    <Link href={href} {...shared}>
      {content}
    </Link>
  ) : (
    <button type="button" {...shared}>
      {content}
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

const THEMES = [
  { value: "system", label: "Match system", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** The workspace switcher, sized to match a nav row. */
function Workspace({ collapsed }: { collapsed?: boolean }) {
  if (collapsed) {
    return (
      <span aria-label="Rivervoice" className="flex size-8 shrink-0 items-center justify-center">
        <span className="flex size-6 items-center justify-center rounded-md bg-foreground text-background">
          <Waves className="size-3.5" />
        </span>
      </span>
    );
  }

  return (
    <button
      type="button"
      // gap-1.5 keeps the label at the same x as the nav rows: 8 + 20 + 6 = 34px
      className="group/ws flex h-10 min-w-0 flex-1 cursor-pointer items-center gap-1.5 rounded-md px-2 text-left transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-foreground text-background">
        <Waves className="size-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">Rivervoice</span>
      </span>
      <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/ws:opacity-100" />
    </button>
  );
}

/** Everything between the workspace switcher and the pinned footer. */
function SidebarSections({
  agentsMark,
  collapsed,
}: {
  agentsMark?: React.ReactNode;
  collapsed?: boolean;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-1.5 pt-1 pb-2">
      <div className="flex flex-col gap-px">
        <Row icon={Search} label="Search" collapsed={collapsed} />
        <Row icon={Sparkles} label="Ask Rivervoice" href="/ask" collapsed={collapsed} />
      </div>

      <div className="mt-3 flex flex-col gap-px">
        <Row {...home} collapsed={collapsed} />
      </div>

      {sections.map((section) => (
        <div
          key={section.title}
          className={cn("flex flex-col gap-px", collapsed ? "mt-2" : "mt-4")}
        >
          <SectionHeader title={section.title} collapsed={collapsed} />
          {section.items.map((item) => (
            <Row
              key={item.label}
              {...item}
              mark={item.label === "Agents" ? agentsMark : undefined}
              collapsed={collapsed}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function SidebarFooter({ collapsed }: { collapsed?: boolean }) {
  const { me } = useUserContext();
  const signOut = useSignOut();
  const { theme, changeTheme } = useThemeTransition();
  const minutesLeft = usage.minutes.included - usage.minutes.used;

  return (
    <div className="border-t border-border p-1.5">
      <div className="flex flex-col gap-px">
        <Row
          icon={Coins}
          label="Credits"
          badge={minutesLeft.toLocaleString()}
          collapsed={collapsed}
        />
        {footerNav.map((item) => (
          <Row key={item.label} {...item} collapsed={collapsed} />
        ))}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              title={collapsed ? "Pavan · Free plan" : undefined}
              className={cn(
                "group/user mt-1 flex h-11 w-full cursor-pointer items-center gap-2 rounded-md text-left transition-colors hover:bg-accent aria-expanded:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
                collapsed ? "justify-center px-0" : "px-2",
              )}
            />
          }
        >
          <Avatar size="sm">
            <AvatarFallback className="bg-muted text-[11px]">
              {initials(me.user.name)}
            </AvatarFallback>
          </Avatar>
          {collapsed ? null : (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{me.user.name}</span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {me.org.name}
                </span>
              </span>
              <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/user:opacity-100" />
            </>
          )}
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" side="top" className="w-56 p-1">
          <div className="px-2 pt-1.5 pb-2">
            <p className="truncate text-[13px] font-medium">{me.user.name}</p>
            <p className="truncate text-[11px] text-muted-foreground">{me.user.email}</p>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="cursor-pointer gap-2.5 px-2 py-2 text-[13px]">
            <Settings className="size-4 text-muted-foreground" strokeWidth={1.75} />
            Settings
          </DropdownMenuItem>

          {/* Theme lives with the account, the way Notion and Linear do it */}
          <div className="flex items-center gap-2.5 px-2 py-2">
            <MoonStar className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
            <span className="flex-1 text-[13px]">Theme</span>
            <div className="flex items-center gap-0.5 rounded-full bg-muted p-0.5">
              {THEMES.map((option) => {
                const active = theme === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-label={option.label}
                    aria-pressed={active}
                    title={option.label}
                    onClick={(event) => changeTheme(option.value, originOf(event.currentTarget))}
                    /* Naming only the selected pill lets the browser morph it
                       from the old position to the new one during the wipe. */
                    style={active ? { viewTransitionName: "theme-pill" } : undefined}
                    className={cn(
                      "flex size-6 cursor-pointer items-center justify-center rounded-full transition-colors",
                      active
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <option.icon className="size-3.5" strokeWidth={1.75} />
                  </button>
                );
              })}
            </div>
          </div>
          <DropdownMenuItem className="cursor-pointer gap-2.5 px-2 py-2 text-[13px]">
            <Users className="size-4 text-muted-foreground" strokeWidth={1.75} />
            Members
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer gap-2.5 px-2 py-2 text-[13px]">
            <Sparkles className="size-4 text-muted-foreground" strokeWidth={1.75} />
            Upgrade plan
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => signOut.mutate()}
            disabled={signOut.isPending}
            className="cursor-pointer gap-2.5 px-2 py-2 text-[13px]"
          >
            <LogOut className="size-4 text-muted-foreground" strokeWidth={1.75} />
            {signOut.isPending ? "Signing out…" : "Log out"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/** The fixed rail, from md up. Narrower screens get {@link MobileNav} instead. */
export function Sidebar({ agentsMark }: { agentsMark?: React.ReactNode }) {
  const [collapsed, setCollapsed] = React.useState(false);

  return (
    <aside
      data-collapsed={collapsed ? "" : undefined}
      className={cn(
        "panel hidden h-full shrink-0 flex-col overflow-hidden transition-[width] duration-200 md:flex",
        collapsed ? "w-14" : "w-60",
      )}
    >
      {/* Workspace + collapse toggle. Collapsed, the mark stays put and the
          toggle sits directly beneath it. */}
      <div
        className={cn(
          "flex gap-1 p-1.5 pb-0",
          collapsed ? "flex-col items-center" : "items-center",
        )}
      >
        <Workspace collapsed={collapsed} />

        <button
          type="button"
          onClick={() => setCollapsed((open) => !open)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground",
            "transition-colors hover:bg-accent hover:text-foreground",
            "focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
          )}
        >
          {collapsed ? (
            <ChevronsRight className="size-4.5" strokeWidth={2} />
          ) : (
            <ChevronsLeft className="size-4.5" strokeWidth={2} />
          )}
        </button>
      </div>

      <SidebarSections agentsMark={agentsMark} collapsed={collapsed} />
      <SidebarFooter collapsed={collapsed} />
    </aside>
  );
}

/**
 * Below md the rail would eat the whole screen, so the same nav lives in a
 * drawer behind a bar. Navigating closes it — the pathname is the only signal
 * that reaches here, since the rows are plain links.
 */
export function MobileNav({ agentsMark }: { agentsMark?: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();
  const [shownFor, setShownFor] = React.useState(pathname);

  // Adjusted during render rather than in an effect: the drawer has to be shut
  // before the new page paints, or it covers what you just navigated to.
  if (pathname !== shownFor) {
    setShownFor(pathname);
    setOpen(false);
  }

  return (
    <div className="panel flex h-12 shrink-0 items-center gap-1 px-1.5 md:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={
            <button
              type="button"
              aria-label="Open navigation"
              className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
            />
          }
        >
          <Menu className="size-5" strokeWidth={1.75} />
        </SheetTrigger>

        <SheetContent side="left">
          <SheetTitle className="sr-only">Navigation</SheetTitle>

          <div className="flex items-center gap-1 p-1.5 pb-0">
            <Workspace />
          </div>

          <SidebarSections agentsMark={agentsMark} />
          <SidebarFooter />
        </SheetContent>
      </Sheet>

      <span className="flex min-w-0 items-center gap-1.5">
        <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-foreground text-background">
          <Waves className="size-3.5" />
        </span>
        <span className="truncate text-sm font-medium">Rivervoice</span>
      </span>
    </div>
  );
}
