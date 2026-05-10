"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  Download,
  Plus,
  UserPlus,
  Layers,
  ClipboardList,
} from "lucide-react";

interface DashboardStats {
  totalDrivers: number;
  activeDrivers: number;
  allocatedDrivers: number;
  onRunDrivers: number;
  pendingRequests: number;
  runsToday: number;
  runsCompleted: number;
  avgCapacity: number;
  recentRequests: RecentRequest[];
}

interface RecentRequest {
  id: number;
  status: string;
  drivers_requested: number;
  business_id: number;
  created_at: string;
  notes: string | null;
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

const STATUS_DOT: Record<string, string> = {
  pending: "bg-blue-500",
  accepted: "bg-emerald-500",
  partially_allocated: "bg-amber-400",
  fully_allocated: "bg-emerald-600",
  completed: "bg-emerald-500",
  rejected: "bg-red-400",
  cancelled: "bg-gray-400",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "received",
  accepted: "approved",
  partially_allocated: "partially allocated",
  fully_allocated: "fully allocated",
  completed: "completed",
  rejected: "rejected",
  cancelled: "cancelled",
};

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
        {label}
      </p>
      <p className="mt-2 text-4xl font-bold text-gray-900">{value}</p>
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

  useEffect(() => {
    const load = async () => {
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
    };

    load();
  }, []);

  return (
    <div className="flex flex-col min-h-full bg-gray-50">
      {/* Breadcrumb */}
      <div className="px-8 py-3 border-b bg-white">
        <p className="text-sm text-gray-400">Dashboard</p>
      </div>

      <div className="flex-1 px-8 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Provider Dashboard</h1>
            <p className="mt-1 text-sm text-gray-500">
              {greeting()} — here is your operations overview
            </p>
          </div>
        </div>

        {/* Stats */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border border-gray-200 bg-white p-6 animate-pulse"
              >
                <div className="h-3 w-24 bg-gray-200 rounded mb-4" />
                <div className="h-9 w-16 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-100 bg-red-50 px-6 py-4 text-sm text-red-600">
            {error}
          </div>
        ) : stats ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
              <StatCard label="Total Drivers" value={stats.totalDrivers} />
              <StatCard label="Active" value={stats.activeDrivers} />
              <StatCard label="Allocated" value={stats.allocatedDrivers} />
              <StatCard label="On Run" value={stats.onRunDrivers} />
              <StatCard label="Pending Requests" value={stats.pendingRequests} />
              <StatCard label="Runs Today" value={stats.runsToday} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
              <StatCard label="Runs Completed" value={stats.runsCompleted} />
              <StatCard label="Avg Capacity" value={`${stats.avgCapacity}%`} />
            </div>
          </>
        ) : null}

        {/* Bottom section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Activity */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-gray-900">Recent Activity</h2>
              <button
                onClick={() => router.push("/dashboard/requests")}
                className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
              >
                View all
              </button>
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
            ) : stats?.recentRequests.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">No recent activity</p>
            ) : (
              <ul className="space-y-4">
                {stats?.recentRequests.map((req) => (
                  <li key={req.id} className="flex items-start gap-3">
                    <span
                      className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${STATUS_DOT[req.status] ?? "bg-gray-400"}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-gray-800 truncate">
                          ARQ-{String(req.id).padStart(4, "0")}{" "}
                          {STATUS_LABEL[req.status] ?? req.status}
                        </p>
                        <span className="text-xs text-gray-400 shrink-0">
                          {timeAgo(req.created_at)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {req.drivers_requested} driver{req.drivers_requested !== 1 ? "s" : ""} requested
                        {req.notes ? ` • ${req.notes}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Quick Actions */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-5">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-4">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action.label}
                  onClick={() => router.push(action.href)}
                  className="flex flex-col items-center gap-3 rounded-xl border border-gray-200 p-5 text-center hover:bg-gray-50 hover:border-gray-300 transition-colors"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-700">
                    <action.icon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{action.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{action.description}</p>
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
