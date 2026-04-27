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
    description:
      "Manage your drivers, vehicles, and fleet capacity in one place",
  },
  {
    icon: BarChart3,
    title: "Route Operations",
    description:
      "Define coverage areas, zones, and operating schedules for your fleet",
  },
  {
    icon: Users,
    title: "Allocation Requests",
    description:
      "Receive and respond to driver allocation requests from businesses",
  },
  {
    icon: CalendarClock,
    title: "Delivery Schedules",
    description:
      "Handle end-to-end managed delivery commitments and fulfilment",
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
    <div className="min-h-screen flex">
      {/* Left — dark hero */}
      <div className="hidden lg:flex lg:w-[45%] flex-col relative overflow-hidden">
        {/* Background image + dark overlay */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/hero-bg.webp')" }}
        />
        <div className="absolute inset-0 bg-[#0f1f09]/50" />

        {/* Content */}
        <div className="relative z-10 flex flex-col h-full">
          <Navbar />

          <div className="flex-1 flex flex-col justify-end px-10 pb-12">
            <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight mb-10">
              Service Provider
              <br />
              Portal
            </h1>

            <div className="grid grid-cols-2 gap-6">
              {features.map(({ icon: Icon, title, description }) => (
                <div key={title}>
                  <p className="text-[#C8E298] font-semibold text-sm mb-1">{title}</p>
                  <p className="text-white/60 text-xs leading-relaxed">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right — auth forms */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-white overflow-y-auto">
        {mode === "login" ? (
          <Login onToggle={() => setMode("signup")} />
        ) : (
          <Signup onToggle={() => setMode("login")} />
        )}
      </div>
    </div>
  );
}
