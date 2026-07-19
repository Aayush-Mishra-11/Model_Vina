"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Mic,
  Wand2,
  MessagesSquare,
  Briefcase,
  BookOpen,
  Target,
  LineChart,
  FileText,
  User,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/practice", label: "Voice Practice", icon: Mic },
  { href: "/partner", label: "Vani Voice Partner", icon: MessagesSquare },
  { href: "/interview", label: "Mock Interview", icon: Briefcase },
  { href: "/vocabulary", label: "Vocabulary", icon: BookOpen },
  { href: "/challenge", label: "Daily Challenge", icon: Target },
  { href: "/analytics", label: "Analytics", icon: LineChart },
  { href: "/reports", label: "Reports", icon: FileText },
];

const bottomItems: NavItem[] = [
  { href: "/profile", label: "Profile", icon: User },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function DashboardSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  const renderItem = (item: NavItem) => {
    const active = pathname === item.href;
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onNavigate}
        className={cn(
          "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
          active
            ? "text-white font-semibold"
            : "text-muted-foreground hover:bg-secondary hover:text-foreground",
        )}
      >
        {active && (
          <>
            <motion.span
              layoutId="sidebar-active"
              className="absolute inset-0 -z-10 rounded-xl bg-vani-gradient glow-peru"
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
            />
          </>
        )}
        <item.icon className="h-[18px] w-[18px] shrink-0" />
        {item.label}
      </Link>
    );
  };


  return (
    <aside className="flex h-full w-64 flex-col border-r border-border bg-card/50 px-3 py-5">
      <div className="px-2">
        <Logo />
      </div>

      <nav className="mt-8 flex flex-1 flex-col gap-1 overflow-y-auto no-scrollbar">
        <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
          Practice
        </p>
        {navItems.slice(0, 6).map(renderItem)}
        <p className="px-3 pb-2 pt-5 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
          Insights
        </p>
        {navItems.slice(6).map(renderItem)}
      </nav>


      <div className="mt-auto flex flex-col gap-1 border-t border-border pt-3">
        {bottomItems.map(renderItem)}
      </div>
    </aside>
  );
}
