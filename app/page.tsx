"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle,
  Truck,
  Users,
  Route,
  BarChart3,
  Building2,
  Mail,
  Lock,
  User,
  Phone,
  MapPin,
  Eye,
  EyeClosed,
} from "lucide-react";

import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

type OnboardingStep = "auth" | "setup" | "complete";

export default function HomePage() {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("auth");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  // Auth form state
  const [authForm, setAuthForm] = useState({
    email: "",
    password: "",
    phoneNumber: "",
    confirmPassword: "",
    fullName: "",
  });

  const router = useRouter();
  // Setup form state
  const [setupForm, setSetupForm] = useState({
    companyName: "",
    industry: "",
    email: "",
    teamSize: "",
    location: "",
    phone: "",
    operatingHours: "",
  });

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (authMode === "signup") {
        const { email, password, phoneNumber, confirmPassword, fullName } =
          authForm;

        if (password !== confirmPassword) {
          setError("Passwords do not match.");
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              phone: phoneNumber,
            },
          },
        });

        if (error) {
          setError(error.message);
          throw error;
        }

        const user = data.user;
       
        if (!user) throw new Error("User not returned from sign up");
        setError(null);
        setCurrentStep("setup");
      } else {
        const { email, password } = authForm;
        if (!email || !password) {
          throw new Error("Email and password are required.");
        }
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          setError(error.message);
          throw error;
        }

        // For existing users, redirect to dashboard
        router.push("/dashboard");
      }
    } catch (error) {
      console.error("Auth error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setError(userError?.message || "User not authenticated");
        throw userError;
      }

      if (userError || !user) throw new Error("User not authenticated");

      const { error } = await supabase.from("organization").insert({
        company_name: setupForm.companyName,
        industry: setupForm.industry,
        team_size: setupForm.teamSize,
        company_email: setupForm.email,
        company_phone: setupForm.phone,
        headquarters: setupForm.location,
        operating_hours: setupForm.operatingHours,
        user: user.id,
      });

      if (error) {
        setError(error.message);
        throw error;
      }

      setCurrentStep("complete");
    } catch (error) {
      console.error("Setup error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleComplete = () => {
    // Redirect to main dashboard
    router.push("/dashboard");
  };

  const features = [
    {
      icon: Route,
      title: "Smart Route Planning",
      description:
        "AI-powered route optimization that reduces delivery time by up to 40%",
    },
    {
      icon: Users,
      title: "Driver Management",
      description:
        "Comprehensive driver tracking, assignment, and performance monitoring",
    },
    {
      icon: Truck,
      title: "Real-time Tracking",
      description:
        "Live delivery tracking with customer notifications and updates",
    },
    {
      icon: BarChart3,
      title: "Analytics & Insights",
      description:
        "Detailed reports on delivery performance, costs, and efficiency metrics",
    },
  ];

  if (currentStep === "auth") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center p-4">
        <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-8 items-center">
          {/* Left Side - Branding & Features */}
          <div className="space-y-8">
            <div>
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
                  <Truck className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">Roundi</h1>
                  <p className="text-gray-600">Delivery Management Platform</p>
                </div>
              </div>
              <h2 className="text-4xl font-bold text-gray-900 mb-4">
                Streamline Your Delivery Operations
              </h2>
              <p className="text-xl text-gray-600 mb-8">
                Join thousands of businesses using Roundi to optimize their
                delivery operations and delight customers.
              </p>
            </div>

            <div className="grid gap-6">
              {features.map((feature, index) => (
                <div key={index} className="flex items-start space-x-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <feature.icon className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">
                      {feature.title}
                    </h3>
                    <p className="text-gray-600 text-sm">
                      {feature.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center space-x-4 text-sm text-gray-500">
              <div className="flex items-center space-x-1">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>Free 14-day trial</span>
              </div>
              <div className="flex items-center space-x-1">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>No credit card required</span>
              </div>
              <div className="flex items-center space-x-1">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>Cancel anytime</span>
              </div>
            </div>
          </div>

          {/* Right Side - Auth Form */}
          <Card className="w-full max-w-md mx-auto bg-white shadow-xl border-0">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-2xl">
                {authMode === "login" ? "Welcome back" : "Get started today"}
              </CardTitle>
              <CardDescription>
                {authMode === "login"
                  ? "Sign in to your account to continue"
                  : "Create your account to start optimizing deliveries"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs
                value={authMode}
                onValueChange={(value) =>
                  setAuthMode(value as "login" | "signup")
                }
                className="mb-6"
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="login">Sign In</TabsTrigger>
                  <TabsTrigger value="signup">Sign Up</TabsTrigger>
                </TabsList>

                <TabsContent value="login" className="mt-6">
                  <form onSubmit={handleAuthSubmit} className="space-y-4">
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          id="email"
                          type="email"
                          placeholder="you@company.com"
                          className="pl-10"
                          value={authForm.email}
                          onChange={(e) =>
                            setAuthForm({ ...authForm, email: e.target.value })
                          }
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between">
                        <Label htmlFor="password">Password</Label>
                       
                        <p>
                          <Link
                            href="/forgot-password"
                            className="hover:underline hover:text-blue-600 text-sm"
                          >
                            {" "}
                            Forgot Password
                          </Link>
                        </p>
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          className="pl-10"
                          value={authForm.password}
                          onChange={(e) =>
                            setAuthForm({
                              ...authForm,
                              password: e.target.value,
                            })
                          }
                          required
                        />
                        <Button
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 bg-transparent hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                          type="button"
                        >
                          {showPassword ? (
                            <Eye className="h-4 w-4" />
                          ) : (
                            <EyeClosed className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                    {error && (
                      <div className="mb-4 text-red-600 text-sm">{error}</div>
                    )}
                    <Button
                      type="submit"
                      className="w-full bg-blue-600 hover:bg-blue-700"
                      disabled={isLoading}
                    >
                      {isLoading ? "Signing in..." : "Sign In"}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="signup" className="mt-6">
                  <form onSubmit={handleAuthSubmit} className="space-y-4">
                    <div>
                      <Label htmlFor="fullName">Full Name</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          id="fullName"
                          placeholder="John Doe"
                          className="pl-10"
                          value={authForm.fullName}
                          onChange={(e) =>
                            setAuthForm({
                              ...authForm,
                              fullName: e.target.value,
                            })
                          }
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="signup-email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          id="signup-email"
                          type="email"
                          placeholder="you@company.com"
                          className="pl-10"
                          value={authForm.email}
                          onChange={(e) =>
                            setAuthForm({ ...authForm, email: e.target.value })
                          }
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="phoneNumber">Phone Number</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          id="phoneNumber"
                          type="tel"
                          placeholder="+254712345678"
                          className="pl-10"
                          value={authForm.phoneNumber}
                          onChange={(e) =>
                            setAuthForm({
                              ...authForm,
                              phoneNumber: e.target.value,
                            })
                          }
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="signup-password">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          id="signup-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          className="pl-10"
                          value={authForm.password}
                          onChange={(e) =>
                            setAuthForm({
                              ...authForm,
                              password: e.target.value,
                            })
                          }
                          required
                        />
                        <Button
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 bg-transparent hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                          type="button"
                        >
                          {showPassword ? (
                            <Eye className="h-4 w-4" />
                          ) : (
                            <EyeClosed className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="confirm-password">Confirm Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          id="confirm-password"
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="••••••••"
                          className="pl-10"
                          value={authForm.confirmPassword}
                          onChange={(e) =>
                            setAuthForm({
                              ...authForm,
                              confirmPassword: e.target.value,
                            })
                          }
                          required
                        />
                        <Button
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 bg-transparent hover:bg-transparent"
                          onClick={() =>
                            setShowConfirmPassword(!showConfirmPassword)
                          }
                          type="button"
                        >
                          {showConfirmPassword ? (
                            <Eye className="h-4 w-4" />
                          ) : (
                            <EyeClosed className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                    {error && (
                      <div className="mb-4 text-red-600 text-sm">{error}</div>
                    )}
                    <Button
                      type="submit"
                      className="w-full bg-blue-600 hover:bg-blue-700"
                      disabled={isLoading}
                    >
                      {isLoading ? "Creating account..." : "Create Account"}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>

              <div className="text-center text-sm text-gray-500">
                By continuing, you agree to our{" "}
                <a href="#" className="text-blue-600 hover:underline">
                  Terms of Service
                </a>{" "}
                and{" "}
                <a href="#" className="text-blue-600 hover:underline">
                  Privacy Policy
                </a>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (currentStep === "setup") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl bg-white shadow-xl border-0">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-3xl">Set up your organization</CardTitle>
            <CardDescription className="text-lg">
              Let's get your delivery operation configured in just a few steps
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSetupSubmit} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="companyName">Company Name *</Label>
                  <Input
                    id="companyName"
                    placeholder="Acme Delivery Co."
                    value={setupForm.companyName}
                    onChange={(e) =>
                      setSetupForm({
                        ...setupForm,
                        companyName: e.target.value,
                      })
                    }
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="industry">Industry *</Label>
                  <Input
                    id="industry"
                    placeholder="Food & Beverage"
                    value={setupForm.industry}
                    onChange={(e) =>
                      setSetupForm({ ...setupForm, industry: e.target.value })
                    }
                    required
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="teamSize">Email *</Label>
                  <Input
                    id="email"
                    placeholder="10-50 employees"
                    value={setupForm.email}
                    onChange={(e) =>
                      setSetupForm({ ...setupForm, email: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone Number *</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="phone"
                      placeholder="+254 7XX XXX XXX"
                      className="pl-10"
                      value={setupForm.phone}
                      onChange={(e) =>
                        setSetupForm({ ...setupForm, phone: e.target.value })
                      }
                      required
                    />
                  </div>
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="teamSize">Team Size</Label>
                  <Input
                    id="teamSize"
                    placeholder="10-50 employees"
                    value={setupForm.teamSize}
                    onChange={(e) =>
                      setSetupForm({ ...setupForm, teamSize: e.target.value })
                    }
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="location">Primary Location *</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="location"
                    placeholder="Nairobi, Kenya"
                    className="pl-10"
                    value={setupForm.location}
                    onChange={(e) =>
                      setSetupForm({ ...setupForm, location: e.target.value })
                    }
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="operatingHours">Operating Hours</Label>
                <Input
                  id="operatingHours"
                  placeholder="8:00 AM - 6:00 PM"
                  value={setupForm.operatingHours}
                  onChange={(e) =>
                    setSetupForm({
                      ...setupForm,
                      operatingHours: e.target.value,
                    })
                  }
                />
              </div>
              {error && (
                <div className="mb-4 text-red-600 text-sm">{error}</div>
              )}
              <Button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-lg py-6"
                disabled={isLoading}
              >
                {isLoading ? "Setting up your account..." : "Complete Setup"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (currentStep === "complete") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl bg-white shadow-xl border-0">
          <CardContent className="text-center py-12">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Welcome to Roundi! 🎉
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              Your account is ready. Let's start optimizing your delivery
              operations.
            </p>

            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div className="text-left p-4 bg-blue-50 rounded-lg">
                <h3 className="font-semibold text-blue-900 mb-2">
                  Next steps:
                </h3>
                <ul className="space-y-2 text-sm text-blue-700">
                  <li>• Add your first delivery route</li>
                  <li>• Invite and onboard drivers</li>
                  <li>• Set up delivery zones</li>
                  <li>• Configure notifications</li>
                </ul>
              </div>
              <div className="text-left p-4 bg-green-50 rounded-lg">
                <h3 className="font-semibold text-green-900 mb-2">
                  Need help?
                </h3>
                <ul className="space-y-2 text-sm text-green-700">
                  <li>• Check out our quick start guide</li>
                  <li>• Watch tutorial videos</li>
                  <li>• Contact our support team</li>
                  <li>• Join our community forum</li>
                </ul>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                onClick={handleComplete}
                className="bg-blue-600 hover:bg-blue-700 text-lg px-8 py-6"
              >
                Enter Dashboard
              </Button>
              <Button
                variant="outline"
                className="text-lg px-8 py-6 border-gray-300"
              >
                Take a Tour
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}
