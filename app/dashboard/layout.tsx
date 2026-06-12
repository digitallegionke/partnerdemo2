"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
  Route,
  Navigation,
  Grid2X2,
  Users,
  UserSquare2,
  Package,
  CalendarDays,
  Zap,
  Settings,
  HelpCircle,
  LogOut,
  ChevronUp,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  Building2,
} from "lucide-react";
import {
  getProviderAccessProfile,
  signOutProviderUser,
  type ProviderAccessProfile,
} from "@/lib/services/provider-portal-auth";
import { supabase } from "@/lib/supabase";

interface NavCounts {
  drivers: number;
  fleet: number;
  pendingRequests: number;
  deliveries: number;
}

// href → which count key to use (null = no badge)
const BADGE_KEY: Record<string, keyof NavCounts | null> = {
  "/dashboard/drivers":     "drivers",
  "/dashboard/fleet":       "fleet",
  "/dashboard/requests":    "pendingRequests",
  "/dashboard/deliveries":  "deliveries",
};

const NAV_SECTIONS = [
  {
    label: "Operations",
    items: [
      { href: "/dashboard/analytics", label: "Dashboard",  icon: LayoutDashboard },
      { href: "/dashboard/routes",      label: "Routes",      icon: Route },
      { href: "/dashboard/route-names", label: "Route Names", icon: Navigation },
    ],
  },
  {
    label: "Fleet Management",
    items: [
      { href: "/dashboard/fleet",   label: "Fleet Registry", icon: Grid2X2 },
      { href: "/dashboard/drivers", label: "Drivers",        icon: Users },
    ],
  },
  {
    label: "Driver Allocation",
    items: [
      { href: "/dashboard/requests", label: "Allocation Requests", icon: UserSquare2 },
    ],
  },
  {
    label: "Deliveries",
    items: [
      { href: "/dashboard/deliveries", label: "Deliveries", icon: Package },
      { href: "/dashboard/clients",    label: "Clients",    icon: Building2 },
    ],
  },
  {
    label: "Managed Delivery",
    items: [
      { href: "/dashboard/delivery-bookings",  label: "Delivery Bookings",  icon: CalendarDays },
      { href: "/dashboard/on-demand-delivery", label: "On-Demand Delivery", icon: Zap },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/dashboard/settings", label: "Settings", icon: Settings },
    ],
  },
];

function getInitials(email: string | null): string {
  if (!email) return "?";
  const local = email.split("@")[0];
  const parts = local.replace(/[._-]+/g, " ").split(" ").filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return local.slice(0, 2).toUpperCase();
}

function getDisplayName(email: string | null): string {
  if (!email) return "User";
  const local = email.split("@")[0];
  const first = local.replace(/[._-]+/g, " ").split(" ")[0];
  return first.charAt(0).toUpperCase() + first.slice(1);
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [profile, setProfile] = useState<ProviderAccessProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [navCounts, setNavCounts] = useState<NavCounts | null>(null);

  useEffect(() => {
    const checkAccess = async () => {
      const access = await getProviderAccessProfile();
      if (!access) {
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }
      setProfile(access);
      setLoading(false);

      // Fetch nav counts after confirming access
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token ?? "";
        const res = await fetch("/api/dashboard/nav-counts", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) setNavCounts(await res.json());
      } catch {
        // counts remain null — badges simply won't show
      }
    };
    checkAccess();
  }, [pathname, router]);

  const activePath = useMemo(() => pathname, [pathname]);

  const handleSignOut = async () => {
    await signOutProviderUser();
    router.replace("/login");
  };

  const toggleSection = (label: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  if (loading || !profile) {
    return (
      <div className="h-screen flex items-center justify-center text-sm text-muted-foreground">
        Checking provider access...
      </div>
    );
  }

  const initials = getInitials(profile.email);
  const displayName = getDisplayName(profile.email);

  return (
    <div className="h-screen bg-background flex overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`${
          expanded ? "w-[256px]" : "w-[64px]"
        } shrink-0 border-r bg-white flex flex-col h-screen transition-all duration-300 ease-in-out overflow-hidden`}
      >
        {/* Logo + toggle */}
        <div className="flex items-center justify-between px-4 py-4 border-b shrink-0">
          {expanded && (
            <Image
              src="/dark-green-roundi-logo.svg"
              alt="Roundi"
              width={108}
              height={34}
              className="shrink-0"
            />
          )}
          <button
            onClick={() => setExpanded((v) => !v)}
            className={`shrink-0 text-gray-400 hover:text-gray-700 transition-colors rounded-md p-1 hover:bg-gray-100 ${
              !expanded ? "mx-auto" : ""
            }`}
            title={expanded ? "Collapse sidebar" : "Expand sidebar"}
          >
            {expanded ? (
              <PanelLeftClose className="h-5 w-5" />
            ) : (
              <PanelLeftOpen className="h-5 w-5" />
            )}
          </button>
        </div>

        {/* Scrollable nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
          {NAV_SECTIONS.map((section) => {
            const isSectionCollapsed = collapsedSections.has(section.label);
            return (
              <div key={section.label} className="mb-1">
                {/* Section header — only visible when sidebar is expanded */}
                {expanded && (
                  <button
                    onClick={() => toggleSection(section.label)}
                    className="w-full flex items-center justify-between px-2 py-1.5 mb-1 rounded hover:bg-gray-50 transition-colors group"
                  >
                    <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider group-hover:text-gray-500">
                      {section.label}
                    </span>
                    {isSectionCollapsed ? (
                      <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                    ) : (
                      <ChevronUp className="h-3.5 w-3.5 text-gray-400" />
                    )}
                  </button>
                )}

                {/* Section items */}
                {(!isSectionCollapsed || !expanded) && (
                  <div className="space-y-0.5">
                    {section.items.map((item) => {
                      const isActive =
                        activePath === item.href ||
                        activePath.startsWith(item.href + "/");
                      const countKey = BADGE_KEY[item.href];
                      const badge = countKey && navCounts ? navCounts[countKey] : null;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          title={!expanded ? item.label : undefined}
                          className={`flex items-center rounded-md px-3 py-2 text-sm transition-colors ${
                            expanded ? "justify-between gap-2" : "justify-center"
                          } ${
                            isActive
                              ? "bg-gray-100 text-gray-900 font-medium"
                              : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
                          }`}
                        >
                          <span
                            className={`flex items-center min-w-0 ${
                              expanded ? "gap-3" : ""
                            }`}
                          >
                            <item.icon className="h-[15px] w-[15px] shrink-0" />
                            {expanded && (
                              <span className="truncate">{item.label}</span>
                            )}
                          </span>
                          {expanded && badge !== null && badge !== undefined && (
                            <span className="ml-auto text-[11px] font-medium text-gray-500 shrink-0">
                              {badge}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Bottom fixed section */}
        <div className="border-t px-2 py-2 space-y-0.5 shrink-0">
          <Link
            href="/dashboard/support"
            title={!expanded ? "Support" : undefined}
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-colors ${
              !expanded ? "justify-center" : ""
            }`}
          >
            <HelpCircle className="h-[15px] w-[15px] shrink-0" />
            {expanded && "Support"}
          </Link>
          <Link
            href="/dashboard/settings"
            title={!expanded ? "Settings" : undefined}
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-colors ${
              !expanded ? "justify-center" : ""
            }`}
          >
            <Settings className="h-[15px] w-[15px] shrink-0" />
            {expanded && "Settings"}
          </Link>
        </div>

        {/* User profile */}
        <div className="border-t px-3 py-3 shrink-0">
          <div
            className={`flex items-center gap-3 ${
              !expanded ? "justify-center" : ""
            }`}
          >
            <div
              className="h-8 w-8 rounded-full bg-gray-800 text-white flex items-center justify-center text-xs font-semibold shrink-0"
              title={!expanded ? `${displayName} • ${profile.email}` : undefined}
            >
              {initials}
            </div>
            {expanded && (
              <>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate leading-tight">
                    {displayName}
                  </p>
                  <p className="text-xs text-gray-400 truncate leading-tight mt-0.5">
                    {profile.email}
                  </p>
                </div>
                <button
                  onClick={handleSignOut}
                  className="shrink-0 text-gray-400 hover:text-gray-700 transition-colors"
                  title="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto flex flex-col">{children}</main>
    </div>
  );
}
