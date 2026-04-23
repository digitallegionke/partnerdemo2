"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BarChart3, LogOut, Settings, UserSquare2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getProviderAccessProfile,
  signOutProviderUser,
  type ProviderAccessProfile,
} from "@/lib/services/provider-portal-auth";

const NAV_ITEMS = [
  { href: "/dashboard/drivers", label: "Drivers", icon: Users },
  { href: "/dashboard/requests", label: "Allocation Requests", icon: UserSquare2 },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [profile, setProfile] = useState<ProviderAccessProfile | null>(null);
  const [loading, setLoading] = useState(true);

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

  const activePath = useMemo(() => pathname, [pathname]);

  const handleSignOut = async () => {
    await signOutProviderUser();
    router.replace("/login");
  };

  if (loading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Checking provider access...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background grid grid-cols-1 md:grid-cols-[260px_1fr]">
      <aside className="border-r p-4 space-y-4">
        <div>
          <p className="text-sm text-muted-foreground">Provider Portal</p>
          <h1 className="text-lg font-semibold">{profile.providerName}</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Role: {profile.role} · Status: {profile.providerStatus}
          </p>
        </div>
        <nav className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = activePath === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <Button variant="outline" className="w-full justify-start gap-2" onClick={handleSignOut}>
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </aside>
      <main className="p-6">{children}</main>
    </div>
  );
}
