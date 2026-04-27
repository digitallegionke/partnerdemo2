"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { AuthService } from "@/lib/services/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type SignupFormData = {
  businessName: string;
  contactPerson: string;
  phoneNumber: string;
  email: string;
  serviceMode: string;
  password: string;
  confirmPassword: string;
};

const initialFormData: SignupFormData = {
  businessName: "",
  contactPerson: "",
  phoneNumber: "",
  email: "",
  serviceMode: "",
  password: "",
  confirmPassword: "",
};

export default function SignupPage() {
  const [showPw, setShowPw] = useState(false);
  const [showCp, setShowCp] = useState(false);
  const [formData, setFormData] = useState<SignupFormData>(initialFormData);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }

    if (!formData.serviceMode) {
      setError("Please select a service mode");
      return;
    }

    setLoading(true);

    // Uses existing project auth signup service
    const result = await AuthService.signup(
      formData.email,
      formData.password,
      formData.contactPerson,
      formData.phoneNumber
    );

    if (result.success) {
      setSuccess("Account created successfully! You can now sign in.");
      setFormData(initialFormData);
    } else {
      setError(result.error || "Failed to create account. Please try again.");
    }

    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-muted/20 p-6">
      <Card className="mx-auto max-w-xl">
        <CardHeader>
          <CardTitle>Register your fleet</CardTitle>
          <CardDescription>
            Create a provider account to start managing operations
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {success ? (
            <Alert className="mb-4 border-emerald-300 text-emerald-700 [&>svg]:text-emerald-700">
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          ) : null}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1.5">
              <Label htmlFor="businessName">Business Name</Label>
              <Input
                id="businessName"
              type="text"
              name="businessName"
              placeholder="Enter Business Name"
              value={formData.businessName}
              onChange={handleChange}
              required
              disabled={loading}
            />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="contactPerson">Contact Person</Label>
              <Input
                id="contactPerson"
              type="text"
              name="contactPerson"
              placeholder="Full Name"
              value={formData.contactPerson}
              onChange={handleChange}
              required
              disabled={loading}
            />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phoneNumber">Phone Number</Label>
              <Input
                id="phoneNumber"
              type="tel"
              name="phoneNumber"
              placeholder="+254 700 000 000"
              value={formData.phoneNumber}
              onChange={handleChange}
              required
              disabled={loading}
            />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
              type="email"
              name="email"
              placeholder="Enter Email"
              value={formData.email}
              onChange={handleChange}
              required
              disabled={loading}
            />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="serviceMode">Service Mode</Label>
              <Select
              value={formData.serviceMode}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, serviceMode: value }))
                }
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
                type={showPw ? "text" : "password"}
                name="password"
                  className="pr-10"
                placeholder="Enter Password"
                value={formData.password}
                onChange={handleChange}
                required
                disabled={loading}
              />
                <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                type={showCp ? "text" : "password"}
                name="confirmPassword"
                  className="pr-10"
                placeholder="Confirm Password"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                disabled={loading}
              />
                <button
                type="button"
                onClick={() => setShowCp((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {showCp ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              By continuing, you agree to our{" "}
              <Link href="/terms-and-conditions" className="underline">
                Terms of Service
              </Link>
              .
            </p>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating Account..." : "Create Account"}
            </Button>
          </form>

          <p className="mt-4 text-sm text-muted-foreground">
            Already registered?{" "}
            <Link href="/login" className="font-medium underline">
              Login
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
