"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { CheckCircle, Truck, User, Phone, Mail, Camera, Upload, MapPin, Clock, Shield } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import Link from "next/link"

type DriverOnboardingStep = "welcome" | "personal" | "vehicle" | "documents" | "verification" | "complete"

export default function DriverOnboardingPage() {
  const [currentStep, setCurrentStep] = useState<DriverOnboardingStep>("welcome")
  const [isLoading, setIsLoading] = useState(false)
  
  // Form state
  const [driverForm, setDriverForm] = useState({
    // Personal Info
    fullName: "",
    email: "",
    phone: "",
    address: "",
    emergencyContact: "",
    emergencyPhone: "",
    
    // Vehicle Info
    vehicleType: "",
    vehicleMake: "",
    vehicleModel: "",
    vehicleYear: "",
    licensePlate: "",
    insuranceProvider: "",
    
    // Documents
    driverLicense: null as File | null,
    vehicleRegistration: null as File | null,
    insurance: null as File | null,
    profilePhoto: null as File | null,
  })

  const steps = [
    { id: "welcome", title: "Welcome", description: "Introduction" },
    { id: "personal", title: "Personal Info", description: "Your details" },
    { id: "vehicle", title: "Vehicle Info", description: "Vehicle details" },
    { id: "documents", title: "Documents", description: "Upload documents" },
    { id: "verification", title: "Verification", description: "Review & verify" },
    { id: "complete", title: "Complete", description: "All done!" },
  ]

  const getCurrentStepIndex = () => {
    return steps.findIndex(step => step.id === currentStep)
  }

  const getProgress = () => {
    return ((getCurrentStepIndex() + 1) / steps.length) * 100
  }

  const handleNext = () => {
    const currentIndex = getCurrentStepIndex()
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1].id as DriverOnboardingStep)
    }
  }

  const handlePrevious = () => {
    const currentIndex = getCurrentStepIndex()
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1].id as DriverOnboardingStep)
    }
  }

  const handleFileUpload = (field: string, file: File | null) => {
    setDriverForm({...driverForm, [field]: file})
  }

  const handleSubmit = async () => {
    setIsLoading(true)
    try {
      // Simulate submission
      await new Promise(resolve => setTimeout(resolve, 2000))
      setCurrentStep("complete")
    } catch (error) {
      console.error("Submission error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  if (currentStep === "welcome") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-green-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl bg-white shadow-xl border-0">
          <CardContent className="text-center py-12">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Truck className="w-10 h-10 text-green-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Welcome to the Roundi Driver Team! 🚚
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              We're excited to have you join our delivery network. Let's get you set up to start making deliveries.
            </p>

            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <User className="w-8 h-8 text-[#C8E298] mx-auto mb-2" />
                <h3 className="font-semibold text-blue-900 mb-1">Personal Info</h3>
                <p className="text-sm text-blue-700">Share your basic details</p>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <Truck className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                <h3 className="font-semibold text-purple-900 mb-1">Vehicle Details</h3>
                <p className="text-sm text-purple-700">Tell us about your vehicle</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <Shield className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <h3 className="font-semibold text-green-900 mb-1">Verification</h3>
                <p className="text-sm text-green-700">Upload required documents</p>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-8">
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Clock className="w-3 h-3 text-white" />
                </div>
                <div className="text-left">
                  <h4 className="font-semibold text-yellow-800 mb-1">Estimated Time: 10-15 minutes</h4>
                  <p className="text-sm text-yellow-700">
                    Have your driver's license, vehicle registration, and insurance documents ready.
                  </p>
                </div>
              </div>
            </div>

            <Button 
              onClick={handleNext}
              className="bg-green-600 hover:bg-green-700 text-lg px-8 py-6"
            >
              Start Onboarding
            </Button>
          </CardContent>
        </Card>
      </div>
    )
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
              Welcome to the team! 🎉
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              Your application has been submitted and is under review. We'll notify you once approved.
            </p>

            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div className="text-left p-4 bg-blue-50 rounded-lg">
                <h3 className="font-semibold text-blue-900 mb-2">What's next?</h3>
                <ul className="space-y-2 text-sm text-blue-700">
                  <li>• We'll review your documents (1-2 business days)</li>
                  <li>• You'll receive an approval email</li>
                  <li>• Download the driver mobile app</li>
                  <li>• Attend orientation session</li>
                </ul>
              </div>
              <div className="text-left p-4 bg-green-50 rounded-lg">
                <h3 className="font-semibold text-green-900 mb-2">Need help?</h3>
                <ul className="space-y-2 text-sm text-green-700">
                  <li>• Call: +254 700 123 456</li>
                  <li>• Email: drivers@roundi.com</li>
                  <li>• WhatsApp support available</li>
                  <li>• Check our driver FAQ</li>
                </ul>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button className="bg-green-600 hover:bg-green-700 text-lg px-8 py-6">
                Download Driver App
              </Button>
              <Button variant="outline" className="text-lg px-8 py-6 border-gray-300">
                Contact Support
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Progress Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900">Driver Onboarding</h1>
            <Badge variant="outline" className="bg-white">
              Step {getCurrentStepIndex() + 1} of {steps.length}
            </Badge>
          </div>
          <Progress value={getProgress()} className="h-2" />
          <div className="flex justify-between mt-2">
            {steps.map((step, index) => (
              <div key={step.id} className={`text-xs ${index <= getCurrentStepIndex() ? 'text-[#C8E298]' : 'text-gray-400'}`}>
                {step.title}
              </div>
            ))}
          </div>
        </div>

        <Card className="bg-white shadow-lg border-0">
          <CardContent className="p-8">
            {currentStep === "personal" && (
              <div>
                <h2 className="text-xl font-semibold mb-6">Personal Information</h2>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="fullName">Full Name *</Label>
                    <Input
                      id="fullName"
                      placeholder="John Doe"
                      value={driverForm.fullName}
                      onChange={(e) => setDriverForm({...driverForm, fullName: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email Address *</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="john@example.com"
                      value={driverForm.email}
                      onChange={(e) => setDriverForm({...driverForm, email: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone Number *</Label>
                    <Input
                      id="phone"
                      placeholder="+254 7XX XXX XXX"
                      value={driverForm.phone}
                      onChange={(e) => setDriverForm({...driverForm, phone: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="address">Home Address</Label>
                    <Input
                      id="address"
                      placeholder="123 Main Street, Nairobi"
                      value={driverForm.address}
                      onChange={(e) => setDriverForm({...driverForm, address: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="emergencyContact">Emergency Contact Name</Label>
                    <Input
                      id="emergencyContact"
                      placeholder="Jane Doe"
                      value={driverForm.emergencyContact}
                      onChange={(e) => setDriverForm({...driverForm, emergencyContact: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="emergencyPhone">Emergency Contact Phone</Label>
                    <Input
                      id="emergencyPhone"
                      placeholder="+254 7XX XXX XXX"
                      value={driverForm.emergencyPhone}
                      onChange={(e) => setDriverForm({...driverForm, emergencyPhone: e.target.value})}
                    />
                  </div>
                </div>
              </div>
            )}

            {currentStep === "vehicle" && (
              <div>
                <h2 className="text-xl font-semibold mb-6">Vehicle Information</h2>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="vehicleType">Vehicle Type *</Label>
                    <Select value={driverForm.vehicleType} onValueChange={(value) => setDriverForm({...driverForm, vehicleType: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select vehicle type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="motorcycle">Motorcycle</SelectItem>
                        <SelectItem value="car">Car</SelectItem>
                        <SelectItem value="van">Van</SelectItem>
                        <SelectItem value="truck">Truck</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="vehicleMake">Vehicle Make *</Label>
                    <Input
                      id="vehicleMake"
                      placeholder="Toyota, Honda, etc."
                      value={driverForm.vehicleMake}
                      onChange={(e) => setDriverForm({...driverForm, vehicleMake: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="vehicleModel">Vehicle Model *</Label>
                    <Input
                      id="vehicleModel"
                      placeholder="Corolla, Civic, etc."
                      value={driverForm.vehicleModel}
                      onChange={(e) => setDriverForm({...driverForm, vehicleModel: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="vehicleYear">Year</Label>
                    <Input
                      id="vehicleYear"
                      placeholder="2020"
                      value={driverForm.vehicleYear}
                      onChange={(e) => setDriverForm({...driverForm, vehicleYear: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="licensePlate">License Plate *</Label>
                    <Input
                      id="licensePlate"
                      placeholder="KCA 123D"
                      value={driverForm.licensePlate}
                      onChange={(e) => setDriverForm({...driverForm, licensePlate: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="insuranceProvider">Insurance Provider</Label>
                    <Input
                      id="insuranceProvider"
                      placeholder="CIC Insurance, AAR, etc."
                      value={driverForm.insuranceProvider}
                      onChange={(e) => setDriverForm({...driverForm, insuranceProvider: e.target.value})}
                    />
                  </div>
                </div>
              </div>
            )}

            {currentStep === "documents" && (
              <div>
                <h2 className="text-xl font-semibold mb-6">Upload Documents</h2>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <Label>Driver's License *</Label>
                      <div className="mt-2 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                        <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-600">Upload front and back of license</p>
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          onChange={(e) => handleFileUpload('driverLicense', e.target.files?.[0] || null)}
                          className="hidden"
                          id="driver-license"
                        />
                        <Button variant="outline" className="mt-2" onClick={() => document.getElementById('driver-license')?.click()}>
                          Choose File
                        </Button>
                      </div>
                    </div>

                    <div>
                      <Label>Vehicle Registration *</Label>
                      <div className="mt-2 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                        <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-600">Upload vehicle logbook</p>
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          onChange={(e) => handleFileUpload('vehicleRegistration', e.target.files?.[0] || null)}
                          className="hidden"
                          id="vehicle-registration"
                        />
                        <Button variant="outline" className="mt-2" onClick={() => document.getElementById('vehicle-registration')?.click()}>
                          Choose File
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label>Insurance Certificate *</Label>
                      <div className="mt-2 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                        <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-600">Current insurance certificate</p>
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          onChange={(e) => handleFileUpload('insurance', e.target.files?.[0] || null)}
                          className="hidden"
                          id="insurance"
                        />
                        <Button variant="outline" className="mt-2" onClick={() => document.getElementById('insurance')?.click()}>
                          Choose File
                        </Button>
                      </div>
                    </div>

                    <div>
                      <Label>Profile Photo</Label>
                      <div className="mt-2 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                        <Camera className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-600">Professional headshot</p>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleFileUpload('profilePhoto', e.target.files?.[0] || null)}
                          className="hidden"
                          id="profile-photo"
                        />
                        <Button variant="outline" className="mt-2" onClick={() => document.getElementById('profile-photo')?.click()}>
                          Choose File
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {currentStep === "verification" && (
              <div>
                <h2 className="text-xl font-semibold mb-6">Review & Verify</h2>
                <div className="space-y-6">
                  <div className="bg-blue-50 rounded-lg p-6">
                    <h3 className="font-semibold text-blue-900 mb-4">Personal Information</h3>
                    <div className="grid md:grid-cols-2 gap-4 text-sm">
                      <div><span className="font-medium">Name:</span> {driverForm.fullName}</div>
                      <div><span className="font-medium">Email:</span> {driverForm.email}</div>
                      <div><span className="font-medium">Phone:</span> {driverForm.phone}</div>
                      <div><span className="font-medium">Address:</span> {driverForm.address}</div>
                    </div>
                  </div>

                  <div className="bg-purple-50 rounded-lg p-6">
                    <h3 className="font-semibold text-purple-900 mb-4">Vehicle Information</h3>
                    <div className="grid md:grid-cols-2 gap-4 text-sm">
                      <div><span className="font-medium">Type:</span> {driverForm.vehicleType}</div>
                      <div><span className="font-medium">Make/Model:</span> {driverForm.vehicleMake} {driverForm.vehicleModel}</div>
                      <div><span className="font-medium">Year:</span> {driverForm.vehicleYear}</div>
                      <div><span className="font-medium">License Plate:</span> {driverForm.licensePlate}</div>
                    </div>
                  </div>

                  <div className="bg-green-50 rounded-lg p-6">
                    <h3 className="font-semibold text-green-900 mb-4">Documents Uploaded</h3>
                    <div className="grid md:grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span>Driver's License: {driverForm.driverLicense ? 'Uploaded' : 'Missing'}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span>Vehicle Registration: {driverForm.vehicleRegistration ? 'Uploaded' : 'Missing'}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span>Insurance: {driverForm.insurance ? 'Uploaded' : 'Missing'}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span>Profile Photo: {driverForm.profilePhoto ? 'Uploaded' : 'Optional'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <h4 className="font-semibold text-yellow-800 mb-2">Terms & Conditions</h4>
                    <p className="text-sm text-yellow-700 mb-3">
                      By submitting this application, you agree to our driver terms and conditions, 
                      privacy policy, and code of conduct.
                    </p>
                    <label className="flex items-center space-x-2">
                      <input type="checkbox" className="rounded" required />
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
                  </div>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between pt-8 border-t">
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
                  className="bg-[#C8E298] hover:bg-[#274690]"
                >
                  Next
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 