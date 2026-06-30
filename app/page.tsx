"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Users, Truck, BarChart3, CalendarClock } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Login } from "@/components/Login";
import { Signup } from "@/components/Signup";
import { getProviderAccessProfile } from "@/lib/services/provider-portal-auth";

const features = [
  {
    icon: Truck,
    title: "Fleet Management",
    description: "Manage your drivers, vehicles, and fleet capacity in one place",
  },
  {
    icon: BarChart3,
    title: "Route Operations",
    description: "Define coverage areas, zones, and operating schedules for your fleet",
  },
  {
    icon: Users,
    title: "Allocation Requests",
    description: "Receive and respond to driver allocation requests from businesses",
  },
  {
    icon: CalendarClock,
    title: "Delivery Schedules",
    description: "Handle end-to-end managed delivery commitments and fulfilment",
  },
];

export default function HomePage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");

  useEffect(() => {
    getProviderAccessProfile().then((profile) => {
      if (profile) router.replace("/dashboard");
    });
    
  }, [router]);

  return (
    /*
     * Outer container: full viewport height, no overflow on root.
     * Left panel is fixed height (h-screen). Right panel scrolls independently.
     * On mobile (<lg) only the right panel (form) is shown.
     */
    <div className="flex h-screen overflow-hidden">

      {/* ── LEFT PANEL ─────────────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[58%] h-full flex-col relative">

        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('/hero-bg.webp')" }}
        />
        <div className="absolute inset-0 bg-[#0f1f09]/50" />

        {/* Navbar */}
        <div className="relative z-10">
          <Navbar />
        </div>

        {/* Hero content — pinned to bottom */}
        <div className="relative z-10 flex-1 flex flex-col justify-end px-10 pb-12">
          <h1 className="text-5xl xl:text-6xl font-bold text-white leading-tight mb-12">
            Service Provider
            <br />
            Portal
          </h1>

          <div className="grid grid-cols-2 gap-x-8 gap-y-7">
            {features.map(({ title, description }) => (
              <div key={title}>
                <p className="text-white font-semibold text-sm mb-1">{title}</p>
                <p className="text-white/55 text-xs leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL ────────────────────────────────────────────────── */}
      {/*
       * flex-1 so it fills remaining width.
       * overflow-y-auto allows scrolling when the form (Signup) is taller
       * than the viewport. Items are centred horizontally; vertically centred
       * only when there's room, otherwise content starts from top with padding.
       */}
      <div className="flex-1 h-full overflow-y-auto bg-white">
        <div className="min-h-full flex items-center justify-center px-6 py-12 sm:px-10">
          {mode === "login" ? (
            <Login onToggle={() => setMode("signup")} />
          ) : (
            <Signup onToggle={() => setMode("login")} />
          )}
        </div>
      </div>

    </div>
  );
}
