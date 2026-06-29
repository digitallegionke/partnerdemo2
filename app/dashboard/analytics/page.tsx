"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  UserPlus,
  Layers,
  ClipboardList,
} from "lucide-react";
import type { ActivityType, ActivityItem } from "@/app/api/dashboard/stats/route";
import { RefreshButton } from "@/components/ui/refresh-button";

interface DashboardStats {
  totalDrivers: number;
  activeDrivers: number;
  allocatedDrivers: number;
  onRunDrivers: number;
  pendingRequests: number;
  runsToday: number;
  runsCompleted: number;
  avgCapacity: number;
  recentActivity: ActivityItem[];
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const ACTIVITY_TYPE_CONFIG: Record<
  ActivityType,
  { dot: string; badge: string; label: string }
> = {
  request: { dot: "bg-blue-500", badge: "bg-blue-50 text-blue-600", label: "Request" },
  delivery: { dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700", label: "Delivery" },
  driver: { dot: "bg-violet-500", badge: "bg-violet-50 text-violet-600", label: "Driver" },
  route: { dot: "bg-amber-500", badge: "bg-amber-50 text-amber-700", label: "Route" },
  vehicle: { dot: "bg-orange-500", badge: "bg-orange-50 text-orange-600", label: "Vehicle" },
  client: { dot: "bg-gray-500", badge: "bg-gray-100 text-gray-600", label: "Client" },
};

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
      <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-widest text-gray-400">
        {label}
      </p>
      <p className="mt-2 text-2xl sm:text-3xl xl:text-4xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

const QUICK_ACTIONS = [
  {
    icon: UserPlus,
    label: "Add Driver",
    description: "Register a new driver",
    href: "/dashboard/drivers?action=add",
  },
  {
    icon: Layers,
    label: "Create Route",
    description: "Define a new route",
    href: "/dashboard/routes",
  },
  {
    icon: ClipboardList,
    label: "View Requests",
    description: "Allocation inbox",
    href: "/dashboard/requests",
  },
];

export default function ProviderDashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? "";

      const res = await fetch("/api/dashboard/stats", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }

      const data = await res.json();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load stats");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  return (
    <div className="flex flex-col min-h-full bg-gray-50">
      {/* Breadcrumb */}
      <div className="px-4 sm:px-4 md:px-5 py-3 border-b bg-white">
        <p className="text-sm text-gray-400">Dashboard</p>
      </div>

      <div className="flex-1 px-4 sm:px-4 md:px-5 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Provider Dashboard</h1>
            <p className="mt-1 text-sm text-gray-500">
              {greeting()} — here is your operations overview
            </p>
          </div>
          <RefreshButton onClick={loadStats} loading={loading} />
        </div>

        {/* Stats */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6 animate-pulse"
              >
                <div className="h-3 w-20 bg-gray-200 rounded mb-4" />
                <div className="h-8 w-14 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 sm:px-6 py-4 text-sm text-red-600">
            {error}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <StatCard label="Total Drivers" value={stats.totalDrivers} />
            <StatCard label="Active" value={stats.activeDrivers} />
            <StatCard label="Allocated" value={stats.allocatedDrivers} />
            <StatCard label="On Run" value={stats.onRunDrivers} />
            <StatCard label="Pending Requests" value={stats.pendingRequests} />
            <StatCard label="Runs Today" value={stats.runsToday} />
            <StatCard label="Runs Completed" value={stats.runsCompleted} />
            <StatCard label="Avg Capacity" value={`${stats.avgCapacity}%`} />
          </div>
        ) : null}

        {/* Bottom section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Activity */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6 flex flex-col">
            <div className="mb-4 shrink-0">
              <h2 className="text-base font-semibold text-gray-900">Recent Activity</h2>
              <p className="text-xs text-gray-400 mt-0.5">Latest events across all operations</p>
            </div>

            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex gap-3 animate-pulse">
                    <div className="mt-1.5 h-2 w-2 rounded-full bg-gray-200 shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-48 bg-gray-200 rounded" />
                      <div className="h-3 w-32 bg-gray-100 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : !stats?.recentActivity.length ? (
              <p className="text-sm text-gray-400 py-4 text-center">No recent activity</p>
            ) : (
              <ul className="space-y-4 overflow-y-auto max-h-[360px] pr-1 -mr-1 scrollbar-thin">
                {stats.recentActivity.map((item) => {
                  const config =
                    ACTIVITY_TYPE_CONFIG[item.type] ?? {
                      dot: "bg-gray-400",
                      badge: "bg-gray-100 text-gray-500",
                      label: item.type,
                    };
                  return (
                    <li key={item.key} className="flex items-start gap-3">
                      <span
                        className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${config.dot}`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-gray-800 truncate">
                            {item.title}
                          </p>
                          <span className="text-xs text-gray-400 shrink-0">
                            {timeAgo(item.created_at)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-xs text-gray-400 truncate">{item.subtitle}</p>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold shrink-0 ${config.badge}`}
                          >
                            {config.label}
                          </span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Quick Actions */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4 sm:mb-5">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action.label}
                  onClick={() => router.push(action.href)}
                  className="flex flex-col items-center gap-2 sm:gap-3 rounded-xl border border-gray-200 p-4 sm:p-5 text-center hover:bg-gray-50 hover:border-gray-300 transition-colors"
                >
                  <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-emerald-700">
                    <action.icon className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{action.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5 hidden sm:block">{action.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
