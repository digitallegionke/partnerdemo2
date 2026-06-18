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
  Truck,
  Settings,
  HelpCircle,
  LogOut,
  ChevronUp,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  Building2,
  ClipboardList,
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
  routes: number;
  routeNames: number;
  clients: number;
}

// href → which count key to use (null = no badge)
const BADGE_KEY: Record<string, keyof NavCounts | null> = {
  "/dashboard/drivers":           "drivers",
  "/dashboard/fleet":             "fleet",
  "/dashboard/requests":          "pendingRequests",
  "/dashboard/deliveries":        "deliveries",
  "/dashboard/routes":            "routes",
  "/dashboard/route-names":       "routeNames",
  "/dashboard/clients":           "clients",
  "/dashboard/delivery-bookings": null,
};

const NAV_SECTIONS = [
  {
    label: "Operations",
    items: [
      { href: "/dashboard/analytics", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Routes Management",
    items: [
      { href: "/dashboard/routes",      label: "Routes",      icon: Route },
      { href: "/dashboard/route-names", label: "Route Names", icon: Navigation },
    ],
  },
  {
    label: "Fleet & Drivers Management",
    items: [
      { href: "/dashboard/fleet",   label: "Fleet Registry", icon: Grid2X2 },
      { href: "/dashboard/drivers", label: "Drivers",        icon: Users },
    ],
  },
  {
    label: "Deliveries Management",
    items: [
      { href: "/dashboard/requests",          label: "Business Requests", icon: ClipboardList },
      { href: "/dashboard/delivery-bookings", label: "Business Deliveries",        icon: Truck },
      { href: "/dashboard/deliveries",        label: "Partners Deliveries",        icon: Package },
      { href: "/dashboard/clients",           label: "Clients",                    icon: Building2 },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/dashboard/support",  label: "Support",  icon: HelpCircle },
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

  const refreshCounts = async () => {
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

  // Auth check — runs once on mount and on navigation
  useEffect(() => {
    const checkAccess = async () => {
      const access = await getProviderAccessProfile();
      if (!access) {
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }
      setProfile(access);
      setLoading(false);
    };
    checkAccess();
  }, [pathname, router]);

  // Count fetch — runs on navigation and on explicit refresh events from child pages
  useEffect(() => {
    refreshCounts();
    window.addEventListener("navcount:refresh", refreshCounts);
    return () => window.removeEventListener("navcount:refresh", refreshCounts);
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

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
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {NAV_SECTIONS.map((section) => {
            const isSectionCollapsed = collapsedSections.has(section.label);
            return (
              <div key={section.label} className="mb-2">
                {/* Section header — only visible when sidebar is expanded */}
                {expanded && (
                  <button
                    onClick={() => toggleSection(section.label)}
                    className="w-full flex items-center justify-between px-2 pt-3 pb-1.5 group"
                  >
                    <span className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider group-hover:text-gray-800 transition-colors">
                      {section.label}
                    </span>
                    {isSectionCollapsed ? (
                      <ChevronDown className="h-3 w-3 text-gray-400 group-hover:text-gray-600 transition-colors" />
                    ) : (
                      <ChevronUp className="h-3 w-3 text-gray-400 group-hover:text-gray-600 transition-colors" />
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
                          className={`relative flex items-center rounded-lg py-2 text-sm transition-all duration-150 ${
                            expanded ? "justify-between gap-2 px-3" : "justify-center px-2"
                          } ${
                            isActive
                              ? "font-semibold"
                              : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
                          }`}
                          style={isActive ? { backgroundColor: "#e8fca0", color: "#162318" } : {}}
                        >
                          {/* Active left-border accent */}
                          {isActive && (
                            <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full" style={{ backgroundColor: "#a8d44f" }} />
                          )}
                          <span className={`flex items-center min-w-0 ${expanded ? "gap-2.5" : ""}`}>
                            <item.icon
                              className="h-[15px] w-[15px] shrink-0 transition-colors"
                              style={isActive ? { color: "#4a7c10" } : {}}
                            />
                            {expanded && (
                              <span className="truncate">{item.label}</span>
                            )}
                          </span>
                          {expanded && badge !== null && badge !== undefined && (
                            <span
                              className={`ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
                                isActive ? "bg-gray-100 text-gray-500" : "bg-gray-100 text-gray-500"
                              }`}
                              style={isActive ? { backgroundColor: "#CDF782", color: "#162318" } : {}}
                            >
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
