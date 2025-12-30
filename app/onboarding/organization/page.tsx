"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle,
  Building,
  Users,
  Truck,
  MapPin,
  AlertCircle,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import OperatingHoursSelector from "@/app/components/operating-picker";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { RequireAuth } from "@/components/require-auth";
import { industries, validateKenyanPhone } from "@/lib/utils";

type OrganizationOnboardingStep =
  | "welcome"
  | "business"
  | "operations"
  | "verification"
  | "complete";

interface OrganizationForm {
  // Business Profile
  organizationName: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  website: string;
  ordersPerDay: string;
  teamSize: string;
  driversCount: string;
  yearsInBusiness: string;
  industry: string;
  operatingHours: string;
  operatingDays: string;

  // Operations
  primaryDeliveryArea: string;
  deliveryChallenge: string;
  desiredFeatures: string;

  // Additional Info
  termsAccepted: boolean;
}

function OrganizationSetup() {
  const [currentStep, setCurrentStep] =
    useState<OrganizationOnboardingStep>("welcome");
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const router = useRouter();

  const [orgForm, setOrgForm] = useState<OrganizationForm>({
    organizationName: "",
    contactEmail: "",
    contactPhone: "",
    address: "",
    website: "",
    ordersPerDay: "",
    teamSize: "",
    driversCount: "",
    yearsInBusiness: "",
    industry: "",
    primaryDeliveryArea: "",
    deliveryChallenge: "",
    desiredFeatures: "",
    termsAccepted: false,
    operatingHours: "",
    operatingDays: "",
  });

  const steps = [
    { id: "welcome", title: "Welcome", description: "Introduction" },
    { id: "business", title: "Business Info", description: "Company details" },
    { id: "operations", title: "Operations", description: "Delivery info" },
    { id: "verification", title: "Review", description: "Verify details" },
    { id: "complete", title: "Complete", description: "All done!" },
  ];

  const getCurrentStepIndex = () => {
    return steps.findIndex((step) => step.id === currentStep);
  };

  const getProgress = () => {
    return ((getCurrentStepIndex() + 1) / steps.length) * 100;
  };

  const validateStep = (step: OrganizationOnboardingStep): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === "business") {
      if (!orgForm.organizationName.trim())
        newErrors.organizationName = "Organization name is required";
      if (!orgForm.contactEmail.trim())
        newErrors.contactEmail = "Contact email is required";
      if (!orgForm.contactPhone.trim())
        newErrors.contactPhone = "Contact phone is required";
      else {
        // Validate phone format
        const phoneValidation = validateKenyanPhone(orgForm.contactPhone)
        if (!phoneValidation.valid) {
          newErrors.contactPhone = phoneValidation.error || "Invalid phone format"
        }
      }
      if (!orgForm.industry) newErrors.industry = "Please select your industry";
      if (!orgForm.yearsInBusiness.trim())
        newErrors.yearsInBusiness =
          "Please select your organization years in business";
      if (!orgForm.operatingHours?.trim()) {
        newErrors.operatingHours = "Please select your operating hours";
      }
      if (!orgForm.operatingDays?.trim()) {
        newErrors.operatingDays = "Please select your operating days";
      }
    }

    if (step === "operations") {
      if (!orgForm.ordersPerDay)
        newErrors.ordersPerDay = "Please select orders per day";
      if (!orgForm.teamSize) newErrors.teamSize = "Please select team size";
      if (!orgForm.driversCount)
        newErrors.driversCount = "Please select number of drivers";
      if (!orgForm.primaryDeliveryArea)
        newErrors.primaryDeliveryArea = "Please select delivery area";
    }

    if (step === "verification") {
      if (!orgForm.termsAccepted)
        newErrors.termsAccepted = "You must accept the terms and conditions";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    const currentIndex = getCurrentStepIndex();
    const currentStepId = steps[currentIndex].id as OrganizationOnboardingStep;

    if (validateStep(currentStepId)) {
      if (currentIndex < steps.length - 1) {
        setCurrentStep(
          steps[currentIndex + 1].id as OrganizationOnboardingStep
        );
      }
    }
  };

  const handlePrevious = () => {
    const currentIndex = getCurrentStepIndex();
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1].id as OrganizationOnboardingStep);
      setErrors({}); // Clear errors when going back
    }
  };

  const handleSubmit = async () => {
    if (!validateStep("verification")) return;

    setIsLoading(true);
    try {
      // Get the JWT token from Supabase session
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      if (!token) {
        toast({
          title: 'Authentication Error',
          description: 'You must be logged in to complete onboarding.',
        })
        return
      }

      const res = await fetch('/api/onboarding/organization', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          organizationName: orgForm.organizationName,
          contactEmail: orgForm.contactEmail,
          contactPhone: orgForm.contactPhone,
          address: orgForm.address,
          website: orgForm.website,
          ordersPerDay: orgForm.ordersPerDay,
          teamSize: orgForm.teamSize,
          driversCount: orgForm.driversCount,
          yearsInBusiness: orgForm.yearsInBusiness,
          industry: orgForm.industry,
          operatingHours: orgForm.operatingHours,
          operatingDays: orgForm.operatingDays,
          primaryDeliveryArea: orgForm.primaryDeliveryArea,
          deliveryChallenge: orgForm.deliveryChallenge,
          desiredFeatures: orgForm.desiredFeatures,
          termsAccepted: orgForm.termsAccepted,
        }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        toast({
          title: 'Application error',
          description: data.error || 'Failed to setup your organization. Contact us for help!',
        })
        throw new Error(data.error || 'Onboarding failed')
      }

      toast({
        title: 'Success!',
        description: 'Your organization has been registered successfully.',
      })

      setCurrentStep('complete')
    } catch (error) {
      console.error('Submission error:', error)
      toast({
        title: 'Application Error',
        description: 'Error setting up your organization. Contact us for help!',
      })
    } finally {
      setIsLoading(false)
    }
  };

  if (currentStep === "welcome") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl bg-white shadow-xl border-0">
          <CardContent className="text-center py-12">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Building className="w-10 h-10 text-blue-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Welcome to Roundi! 🚀
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              Let's onboard your organization for streamlined delivery
              management and route optimization.
            </p>

            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <Building className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <h3 className="font-semibold text-green-900 mb-1">
                  Business Info
                </h3>
                <p className="text-sm text-green-700">
                  Company details & profile
                </p>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <Truck className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                <h3 className="font-semibold text-purple-900 mb-1">
                  Operations
                </h3>
                <p className="text-sm text-purple-700">Delivery preferences</p>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <CheckCircle className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <h3 className="font-semibold text-blue-900 mb-1">Review</h3>
                <p className="text-sm text-blue-700">Verify & submit</p>
              </div>
            </div>

            <Button
              onClick={handleNext}
              className="bg-blue-600 hover:bg-blue-700 text-lg px-8 py-6"
            >
              Start Setup
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (currentStep === "complete") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-green-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl bg-white shadow-xl border-0">
          <CardContent className="text-center py-12">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Setup Complete! 🎉
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              Your organization has been registered successfully. Thank you for joining Roundi.
            </p>

            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div className="text-left p-4 bg-blue-50 rounded-lg">
                <h3 className="font-semibold text-blue-900 mb-2">
                  What's next?
                </h3>
                <ul className="space-y-2 text-sm text-blue-700">
                  <li>• Go to your dashboard to get started</li>
                  <li>• Set up your routes</li>
                  <li>• Add your drivers</li>
                  <li>• Create deliveries and assign them to routes</li>
                </ul>
              </div>
              <div className="text-left p-4 bg-green-50 rounded-lg">
                <h3 className="font-semibold text-green-900 mb-2">
                  Need help?
                </h3>
                <ul className="space-y-2 text-sm text-green-700">
                  <li>• Call: +254 722 235 314</li>
                  <li>• Email: support@roundi.africa</li>
                  <li>• WhatsApp support available</li>
                  <li>• Visit our help center</li>
                </ul>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                className="bg-blue-600 hover:bg-blue-700 text-lg px-8 py-6"
                onClick={() => router.push("/dashboard")}
              >
                Continue to Dashboard
              </Button>
              {/* <Button
                variant="outline"
                className="text-lg px-8 py-6 border-gray-300"
                onClick={() => window.location.href = '/onboarding/driver'}
              >
                Setup Drivers
              </Button> */}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Progress Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900">
              Organization Setup
            </h1>
            <Badge variant="outline" className="bg-white">
              Step {getCurrentStepIndex() + 1} of {steps.length}
            </Badge>
          </div>
          <Progress value={getProgress()} className="h-2" />
          <div className="flex justify-between mt-2">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={`text-xs ${
                  index <= getCurrentStepIndex()
                    ? "text-blue-600"
                    : "text-gray-400"
                }`}
              >
                {step.title}
              </div>
            ))}
          </div>
        </div>

        <Card className="bg-white shadow-lg border-0">
          <CardContent className="p-8">
            {currentStep === "business" && (
              <div>
                <h2 className="text-xl font-semibold mb-6">
                  Business Information
                </h2>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="organizationName">
                      Organization Name *
                    </Label>
                    <Input
                      id="organizationName"
                      placeholder="Your Company Name"
                      value={orgForm.organizationName}
                      onChange={(e) =>
                        setOrgForm({
                          ...orgForm,
                          organizationName: e.target.value,
                        })
                      }
                      className={
                        errors.organizationName ? "border-red-500" : ""
                      }
                    />
                    {errors.organizationName && (
                      <p className="text-red-500 text-sm mt-1">
                        {errors.organizationName}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="contactEmail">Contact Email *</Label>
                    <Input
                      id="contactEmail"
                      type="email"
                      placeholder="contact@company.com"
                      value={orgForm.contactEmail}
                      onChange={(e) =>
                        setOrgForm({ ...orgForm, contactEmail: e.target.value })
                      }
                      className={errors.contactEmail ? "border-red-500" : ""}
                    />
                    {errors.contactEmail && (
                      <p className="text-red-500 text-sm mt-1">
                        {errors.contactEmail}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="contactPhone">Contact Phone *</Label>
                    <Input
                      id="contactPhone"
                      placeholder="+254 7XX XXX XXX"
                      value={orgForm.contactPhone}
                      onChange={(e) =>
                        setOrgForm({ ...orgForm, contactPhone: e.target.value })
                      }
                      className={errors.contactPhone ? "border-red-500" : ""}
                    />
                    {errors.contactPhone && (
                      <p className="text-red-500 text-sm mt-1">
                        {errors.contactPhone}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="website">Website (Optional)</Label>
                    <Input
                      id="website"
                      placeholder="https://company.com"
                      value={orgForm.website}
                      onChange={(e) =>
                        setOrgForm({ ...orgForm, website: e.target.value })
                      }
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="address">Business Address</Label>
                    <Input
                      id="address"
                      placeholder="123 Business Street, Nairobi"
                      value={orgForm.address}
                      onChange={(e) =>
                        setOrgForm({ ...orgForm, address: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="industry">Industry *</Label>
                    <Select
                      value={orgForm.industry}
                      onValueChange={(value) =>
                        setOrgForm({ ...orgForm, industry: value })
                      }
                    >
                      <SelectTrigger
                        className={errors.industry ? "border-red-500" : ""}
                      >
                        <SelectValue placeholder="Select your industry" />
                      </SelectTrigger>
                      <SelectContent>
                        {industries.map((ind) => (
                          <SelectItem key={ind.value} value={ind.value}>
                            {ind.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.industry && (
                      <p className="text-red-500 text-sm mt-1">
                        {errors.industry}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="yearsInBusiness">Years in Business</Label>
                    <Select
                      value={orgForm.yearsInBusiness}
                      onValueChange={(value) =>
                        setOrgForm({ ...orgForm, yearsInBusiness: value })
                      }
                    >
                      <SelectTrigger
                        className={
                          errors.yearsInBusiness ? "border-red-500" : ""
                        }
                      >
                        <SelectValue placeholder="Select years in business" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="<1">Less than 1 year</SelectItem>
                        <SelectItem value="1–3">1-3 years</SelectItem>
                        <SelectItem value="4–6">4-6 years</SelectItem>
                        <SelectItem value="7+">7+ years</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.yearsInBusiness && (
                      <p className="text-red-500 text-sm mt-1">
                        {errors.yearsInBusiness}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label>Operating Hours *</Label>
                    <Select
                      value={orgForm.operatingHours}
                      onValueChange={(value) =>
                        setOrgForm({ ...orgForm, operatingHours: value })
                      }
                    >
                      <SelectTrigger
                        className={
                          errors.operatingHours ? "border-red-500" : ""
                        }
                      >
                        <SelectValue placeholder="Select operating hours" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="9_5">9 AM – 5 PM</SelectItem>
                        <SelectItem value="8_5">8 AM – 5 PM</SelectItem>
                        <SelectItem value="half_day">
                          Half Day (8 AM – 12 PM)
                        </SelectItem>
                        <SelectItem value="24_hours">24 Hours</SelectItem>
                        {/* <SelectItem value="custom">Custom</SelectItem> */}
                      </SelectContent>
                    </Select>
                    {errors.operatingHours && (
                      <p className="text-red-500 text-sm mt-1">
                        {errors.operatingHours}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label>Operating Days *</Label>
                    <Select
                      value={orgForm.operatingDays}
                      onValueChange={(value) =>
                        setOrgForm({ ...orgForm, operatingDays: value })
                      }
                    >
                      <SelectTrigger
                        className={errors.operatingDays ? "border-red-500" : ""}
                      >
                        <SelectValue placeholder="Select operating days" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekdays">
                          Weekdays (Mon–Fri)
                        </SelectItem>
                        <SelectItem value="full_week">
                          Full Week (Mon–Sun)
                        </SelectItem>
                        <SelectItem value="weekends">
                          Weekends (Sat–Sun)
                        </SelectItem>
                        <SelectItem value="weekdays_excl_holidays">
                          Weekdays excl. Holidays
                        </SelectItem>
                        {/* <SelectItem value="custom">Custom</SelectItem> */}
                      </SelectContent>
                    </Select>
                    {errors.operatingDays && (
                      <p className="text-red-500 text-sm mt-1">
                        {errors.operatingDays}
                      </p>
                    )}
                  </div>{" "}
                </div>
              </div>
            )}

            {currentStep === "operations" && (
              <div>
                <h2 className="text-xl font-semibold mb-6">
                  Operations & Delivery
                </h2>
                <div className="space-y-6">
                  <div>
                    <Label>Orders per day *</Label>
                    <div className="grid grid-cols-5 gap-2 mt-2">
                      {["1–5", "6–10", "11–20", "21–40", "41+"].map(
                        (option) => (
                          <label
                            key={option}
                            className={`flex items-center space-x-2 p-3 border rounded cursor-pointer hover:bg-gray-50 ${
                              orgForm.ordersPerDay === option
                                ? "border-blue-500 bg-blue-50"
                                : ""
                            }`}
                          >
                            <input
                              type="radio"
                              name="ordersPerDay"
                              value={option}
                              checked={orgForm.ordersPerDay === option}
                              onChange={(e) =>
                                setOrgForm({
                                  ...orgForm,
                                  ordersPerDay: e.target.value,
                                })
                              }
                              className="sr-only"
                            />
                            <span className="text-sm">{option}</span>
                          </label>
                        )
                      )}
                    </div>
                    {errors.ordersPerDay && (
                      <p className="text-red-500 text-sm mt-1">
                        {errors.ordersPerDay}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label>Team size *</Label>
                    <div className="grid grid-cols-5 gap-2 mt-2">
                      {["1–5", "6–10", "11–20", "21–50", "51–100", "101+"].map(
                        (option) => (
                          <label
                            key={option}
                            className={`flex items-center space-x-2 p-3 border rounded cursor-pointer hover:bg-gray-50 ${
                              orgForm.teamSize === option
                                ? "border-blue-500 bg-blue-50"
                                : ""
                            }`}
                          >
                            <input
                              type="radio"
                              name="teamSize"
                              value={option}
                              checked={orgForm.teamSize === option}
                              onChange={(e) =>
                                setOrgForm({
                                  ...orgForm,
                                  teamSize: e.target.value,
                                })
                              }
                              className="sr-only"
                            />
                            <span className="text-sm">{option}</span>
                          </label>
                        )
                      )}
                    </div>
                    {errors.teamSize && (
                      <p className="text-red-500 text-sm mt-1">
                        {errors.teamSize}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label>Number of drivers/riders *</Label>
                    <div className="grid grid-cols-5 gap-2 mt-2">
                      {["1", "2–3", "4–5", "6–10", "11+"].map((option) => (
                        <label
                          key={option}
                          className={`flex items-center space-x-2 p-3 border rounded cursor-pointer hover:bg-gray-50 ${
                            orgForm.driversCount === option
                              ? "border-blue-500 bg-blue-50"
                              : ""
                          }`}
                        >
                          <input
                            type="radio"
                            name="driversCount"
                            value={option}
                            checked={orgForm.driversCount === option}
                            onChange={(e) =>
                              setOrgForm({
                                ...orgForm,
                                driversCount: e.target.value,
                              })
                            }
                            className="sr-only"
                          />
                          <span className="text-sm">{option}</span>
                        </label>
                      ))}
                    </div>
                    {errors.driversCount && (
                      <p className="text-red-500 text-sm mt-1">
                        {errors.driversCount}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label>Primary delivery area *</Label>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {[
                        "Within 5 km",
                        "Within city",
                        "Across city",
                        "Regional",
                        "Nationwide",
                      ].map((option) => (
                        <label
                          key={option}
                          className={`flex items-center space-x-2 p-3 border rounded cursor-pointer hover:bg-gray-50 ${
                            orgForm.primaryDeliveryArea === option
                              ? "border-blue-500 bg-blue-50"
                              : ""
                          }`}
                        >
                          <input
                            type="radio"
                            name="primaryDeliveryArea"
                            value={option}
                            checked={orgForm.primaryDeliveryArea === option}
                            onChange={(e) =>
                              setOrgForm({
                                ...orgForm,
                                primaryDeliveryArea: e.target.value,
                              })
                            }
                            className="sr-only"
                          />
                          <span className="text-sm capitalize">
                            {option.replace("-", " ")}
                          </span>
                        </label>
                      ))}
                    </div>
                    {errors.primaryDeliveryArea && (
                      <p className="text-red-500 text-sm mt-1">
                        {errors.primaryDeliveryArea}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="deliveryChallenge">Biggest delivery challenge *</Label>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {[
                        "Late deliveries",
                        "High delivery costs",
                        "Unreliable drivers/riders",
                        "Poor route planning",
                        "Tracking & visibility issues",
                        "Other",
                      ].map((option) => (
                        <label
                          key={option}
                          className={`flex items-center space-x-2 p-3 border rounded cursor-pointer hover:bg-gray-50 ${
                            orgForm.deliveryChallenge === option
                              ? "border-blue-500 bg-blue-50"
                              : ""
                          }`}
                        >
                          <input
                            type="radio"
                            name="deliveryChallenge"
                            value={option}
                            checked={orgForm.deliveryChallenge === option}
                            onChange={(e) =>
                              setOrgForm({
                                ...orgForm,
                                deliveryChallenge: e.target.value,
                              })
                            }
                            className="sr-only"
                          />
                          <span className="text-sm">{option}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="desiredFeatures">
                      Features you would like to see
                    </Label>
                    <Textarea
                      id="desiredFeatures"
                      className="mt-2 h-24"
                      placeholder="Tell us about any specific features or capabilities you would like to see in our delivery management system..."
                      value={orgForm.desiredFeatures}
                      onChange={(e) =>
                        setOrgForm({
                          ...orgForm,
                          desiredFeatures: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            )}

            {currentStep === "verification" && (
              <div>
                <h2 className="text-xl font-semibold mb-6">Review & Verify</h2>
                <div className="space-y-6">
                  <div className="bg-blue-50 rounded-lg p-6">
                    <h3 className="font-semibold text-blue-900 mb-4">
                      Business Information
                    </h3>
                    <div className="grid md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Organization:</span>{" "}
                        {orgForm.organizationName}
                      </div>
                      <div>
                        <span className="font-medium">Email:</span>{" "}
                        {orgForm.contactEmail}
                      </div>
                      <div>
                        <span className="font-medium">Phone:</span>{" "}
                        {orgForm.contactPhone}
                      </div>
                      <div>
                        <span className="font-medium">Industry:</span>{" "}
                        {orgForm.industry}
                      </div>
                      <div>
                        <span className="font-medium">Address:</span>{" "}
                        {orgForm.address}
                      </div>
                      <div>
                        <span className="font-medium">Website:</span>{" "}
                        {orgForm.website || "Not provided"}
                      </div>
                      <div>
                        <span className="font-medium">Years in business:</span>{" "}
                        {orgForm.yearsInBusiness}
                      </div>

                      <div>
                        <span className="font-medium">Operating Hours:</span>{" "}
                        {orgForm.operatingHours}
                      </div>

                      <div>
                        <span className="font-medium">Operating Days:</span>{" "}
                        {orgForm.operatingDays}
                      </div>
                    </div>
                  </div>

                  <div className="bg-green-50 rounded-lg p-6">
                    <h3 className="font-semibold text-green-900 mb-4">
                      Operations Details
                    </h3>
                    <div className="grid md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Orders per day:</span>{" "}
                        {orgForm.ordersPerDay}
                      </div>
                      <div>
                        <span className="font-medium">Team size:</span>{" "}
                        {orgForm.teamSize}
                      </div>
                      <div>
                        <span className="font-medium">Drivers count:</span>{" "}
                        {orgForm.driversCount}
                      </div>
                      <div>
                        <span className="font-medium">Delivery area:</span>{" "}
                        {orgForm.primaryDeliveryArea?.replace("-", " ")}
                      </div>
                      <div>
                        <span className="font-medium">Main challenge:</span>{" "}
                        {orgForm.deliveryChallenge
                          ? orgForm.deliveryChallenge
                          : "None selected"
                        }
                      </div>
                    </div>
                  </div>

                  {orgForm.desiredFeatures && (
                    <div className="bg-purple-50 rounded-lg p-6">
                      <h3 className="font-semibold text-purple-900 mb-4">
                        Desired Features
                      </h3>
                      <p className="text-sm text-purple-700">
                        {orgForm.desiredFeatures}
                      </p>
                    </div>
                  )}

                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <h4 className="font-semibold text-yellow-800 mb-2">
                      Terms & Conditions
                    </h4>
                    <p className="text-sm text-yellow-700 mb-3">
                      By submitting this application, you agree to our terms of
                      service, privacy policy, and platform guidelines.
                    </p>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        className="rounded"
                        checked={orgForm.termsAccepted}
                        onChange={(e) =>
                          setOrgForm({
                            ...orgForm,
                            termsAccepted: e.target.checked,
                          })
                        }
                      />
                      <span className="text-sm text-yellow-800">
                        I agree to the{" "}
                        <Link 
                          href="/terms-and-conditions" 
                          target="_blank"
                          className="underline hover:text-yellow-900"
                        >
                          terms and conditions
                        </Link>
                      </span>
                    </label>
                    {errors.termsAccepted && (
                      <p className="text-red-500 text-sm mt-1">
                        {errors.termsAccepted}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between pt-4 mt-4 border-t">
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={getCurrentStepIndex() === 0}
              >
                Previous
              </Button>

              {currentStep === "verification" ? (
                <Button
                  onClick={handleSubmit}
                  className="bg-green-600 hover:bg-green-700"
                  disabled={isLoading}
                >
                  {isLoading ? "Submitting..." : "Submit Application"}
                </Button>
              ) : (
                <Button
                  onClick={handleNext}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Next
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function OrganizationSetupPage() {
  return (
    <RequireAuth>
      <OrganizationSetup />
    </RequireAuth>
  );
}
