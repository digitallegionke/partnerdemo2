"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { PartnerProviderService } from "@/lib/services/partner-providers";

interface Props {
  onToggle: () => void;
}

export function Login({ onToggle }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    router.replace("/dashboard");
  };

  return (
    <div className="w-full max-w-md">
      <h1 className="text-3xl font-bold text-gray-900 mb-1">Welcome back</h1>
      <p className="text-gray-500 mb-8">Login to your provider account</p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="login-email">Email Address</Label>
          <Input
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="login-password">Password</Label>
          <div className="relative">
            <Input
              id="login-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pr-10"
              required
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Checkbox id="remember-me" />
            <Label htmlFor="remember-me" className="font-normal text-sm cursor-pointer">
              Remember Me
            </Label>
          </div>
          <Link
            href="/reset-password"
            className="text-sm text-[#2d5a1b] hover:underline font-medium"
          >
            Forgot Password?
          </Link>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button
          type="submit"
          className="w-full bg-[#1a2e0f] hover:bg-[#2d4d1a] text-white h-11"
          disabled={loading}
        >
          {loading ? "Signing in..." : "Sign In"}
        </Button>
      </form>

      <p className="mt-5 text-sm text-center text-muted-foreground">
        Don&apos;t have a provider account?{" "}
        <button
          onClick={onToggle}
          className="text-[#2d5a1b] font-semibold hover:underline"
        >
          Register
        </button>
      </p>

      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-3 text-muted-foreground">or</span>
        </div>
      </div>

      <Button variant="outline" className="w-full h-11" asChild>
        <Link href="/">
          <RefreshCw className="w-4 h-4 mr-2" />
          Business Portal Sign In
        </Link>
      </Button>
    </div>
  );
}
