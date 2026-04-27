"use client";

import { useState } from "react";
import { Eye, EyeOff, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PartnerProviderService } from "@/lib/services/partner-providers";

interface Props {
  onToggle: () => void;
}

type FormData = {
  businessName: string;
  contactPerson: string;
  phoneNumber: string;
  email: string;
  serviceMode: string;
  password: string;
  confirmPassword: string;
};

const empty: FormData = {
  businessName: "",
  contactPerson: "",
  phoneNumber: "",
  email: "",
  serviceMode: "",
  password: "",
  confirmPassword: "",
};

export function Signup({ onToggle }: Props) {
  const [form, setForm] = useState<FormData>(empty);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const set = (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (form.password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (!form.serviceMode) {
      setError("Please select a service mode");
      return;
    }

    setLoading(true);

    const result = await PartnerProviderService.register({
      businessName: form.businessName,
      contactPerson: form.contactPerson,
      email: form.email,
      phoneNumber: form.phoneNumber,
      serviceMode: form.serviceMode as "allocation" | "managed_delivery" | "both",
      password: form.password,
    });

    setLoading(false);

    if (!result.success) {
      setError(result.error || "Registration failed. Please try again.");
      return;
    }

    setSuccess(true);
  };

  if (success) {
    return (
      <div className="w-full max-w-md text-center space-y-4">
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mx-auto">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Account created!</h2>
        <p className="text-gray-500 text-sm">
          Your provider account is pending review. You can sign in now.
        </p>
        <Button
          className="w-full bg-[#1a2e0f] hover:bg-[#2d4d1a] text-white h-11 mt-2"
          onClick={onToggle}
        >
          Go to Sign In
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <h1 className="text-3xl font-bold text-gray-900 mb-1">Register your fleet</h1>
      <p className="text-gray-500 mb-6">
        Create a provider account to start managing operations
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="businessName">Business Name</Label>
          <Input
            id="businessName"
            placeholder="Enter Business Name"
            value={form.businessName}
            onChange={set("businessName")}
            required
            disabled={loading}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="contactPerson">Contact Person</Label>
          <Input
            id="contactPerson"
            placeholder="Full Name"
            value={form.contactPerson}
            onChange={set("contactPerson")}
            required
            disabled={loading}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="phoneNumber">Phone Number</Label>
          <Input
            id="phoneNumber"
            type="tel"
            placeholder="+254 700 000 000"
            value={form.phoneNumber}
            onChange={set("phoneNumber")}
            required
            disabled={loading}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">Email Address</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@company.com"
            value={form.email}
            onChange={set("email")}
            required
            disabled={loading}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="serviceMode">Service Mode</Label>
          <Select
            value={form.serviceMode}
            onValueChange={(v) => setForm((prev) => ({ ...prev, serviceMode: v }))}
            disabled={loading}
          >
            <SelectTrigger id="serviceMode">
              <SelectValue placeholder="Select service mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="allocation">Driver Allocation</SelectItem>
              <SelectItem value="managed_delivery">Managed Delivery</SelectItem>
              <SelectItem value="both">Both</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter Password"
              value={form.password}
              onChange={set("password")}
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

        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirm ? "text" : "password"}
              placeholder="Confirm Password"
              value={form.confirmPassword}
              onChange={set("confirmPassword")}
              className="pr-10"
              required
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            >
              {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <p className="text-xs text-muted-foreground">
          By continuing, you agree to our{" "}
          <a href="/terms-and-conditions" className="underline hover:text-foreground">
            Terms of Service
          </a>{" "}
          and{" "}
          <a href="#" className="underline hover:text-foreground">
            Privacy Policy
          </a>
        </p>

        <Button
          type="submit"
          className="w-full bg-[#1a2e0f] hover:bg-[#2d4d1a] text-white h-11"
          disabled={loading}
        >
          {loading ? "Creating Account..." : "Create Account"}
        </Button>
      </form>

      <p className="mt-4 text-sm text-center text-muted-foreground">
        Already registered?{" "}
        <button
          onClick={onToggle}
          className="text-[#2d5a1b] font-semibold hover:underline"
        >
          Login
        </button>
      </p>
    </div>
  );
}
