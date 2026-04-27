"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PartnerProviderService } from "@/lib/services/partner-providers";
import { getProviderAccessProfile } from "@/lib/services/provider-portal-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ProviderLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const nextPath = useMemo(() => {
    const next = searchParams.get("next");
    return next && next.startsWith("/dashboard") ? next : "/dashboard";
  }, [searchParams]);

  useEffect(() => {
    const checkExistingAccess = async () => {
      const profile = await getProviderAccessProfile();
      if (profile) {
        router.replace(nextPath);
        return;
      }
      setChecking(false);
    };
    checkExistingAccess();
  }, [router, nextPath]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await PartnerProviderService.signIn(email, password);
    if (!result.success) {
      setError(result.error || "Failed to sign in");
      setLoading(false);
      return;
    }

    router.replace(nextPath);
  };

  if (checking) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Checking access...</div>;
  }

  return (
    <div className="min-h-screen bg-muted/20 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Provider Portal Login</CardTitle>
          <CardDescription>Sign in with your provider account to continue.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="provider-email">Email</Label>
              <Input
                id="provider-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@provider.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="provider-password">Password</Label>
              <Input
                id="provider-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
          <p className="mt-4 text-sm text-muted-foreground">
            Need business access instead? <Link href="/" className="underline">Go to business portal</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
