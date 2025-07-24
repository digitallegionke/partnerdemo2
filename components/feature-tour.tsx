"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { X, ArrowRight, ArrowLeft, MapPin, Users, Route, BarChart3, Settings, Calendar } from "lucide-react"

type TourStep = {
  id: string
  title: string
  description: string
  icon: React.ComponentType<any>
  target: string
  placement: "top" | "bottom" | "left" | "right"
  content: {
    heading: string
    details: string[]
    tip?: string
  }
}

const tourSteps: TourStep[] = [
  {
    id: "welcome",
    title: "Welcome to Roundi",
    description: "Let's take a quick tour of your delivery management dashboard",
    icon: Route,
    target: "sidebar",
    placement: "right",
    content: {
      heading: "Your Control Center",
      details: [
        "Manage all your delivery operations from this dashboard",
        "Track routes, drivers, and deliveries in real-time",
        "Optimize delivery efficiency with AI-powered tools"
      ],
      tip: "Use the sidebar to navigate between different sections"
    }
  },
  {
    id: "routes",
    title: "Routes Management",
    description: "Create and optimize delivery routes",
    icon: Route,
    target: "routes-section",
    placement: "bottom",
    content: {
      heading: "Smart Route Planning",
      details: [
        "Create new routes with start and end points",
        "Assign drivers to specific routes",
        "View route details and delivery progress",
        "Optimize routes for efficiency"
      ],
      tip: "Click 'Add Route' to create your first delivery route"
    }
  },
  {
    id: "drivers",
    title: "Driver Management",
    description: "Manage your delivery team",
    icon: Users,
    target: "drivers-section", 
    placement: "bottom",
    content: {
      heading: "Your Delivery Team",
      details: [
        "View all drivers and their current status",
        "Add new drivers to your team",
        "Track driver performance and availability",
        "Assign drivers to routes and deliveries"
      ],
      tip: "Green status means driver is active and available"
    }
  },
  {
    id: "deliveries",
    title: "Delivery Tracking",
    description: "Monitor all deliveries in real-time",
    icon: MapPin,
    target: "deliveries-section",
    placement: "bottom", 
    content: {
      heading: "Track Everything",
      details: [
        "See all deliveries with their current status",
        "Update delivery status as they progress",
        "View delivery locations on the map",
        "Get customer feedback and ratings"
      ],
      tip: "Use status filters to quickly find specific deliveries"
    }
  },
  {
    id: "analytics",
    title: "Performance Analytics", 
    description: "Monitor your delivery performance",
    icon: BarChart3,
    target: "analytics-section",
    placement: "bottom",
    content: {
      heading: "Data-Driven Insights",
      details: [
        "Track key metrics like delivery times and costs",
        "Monitor driver performance and efficiency",
        "Identify optimization opportunities",
        "Generate reports for stakeholders"
      ],
      tip: "Check analytics regularly to improve operations"
    }
  },
  {
    id: "optimize",
    title: "Route Optimization",
    description: "AI-powered route optimization",
    icon: Settings,
    target: "optimize-section", 
    placement: "bottom",
    content: {
      heading: "Smart Optimization",
      details: [
        "Automatically optimize routes for minimal travel time",
        "Consider traffic, distance, and driver capacity",
        "Save fuel costs and improve delivery times",
        "Apply optimizations with one click"
      ],
      tip: "Run optimization daily for best results"
    }
  }
]

interface FeatureTourProps {
  isOpen: boolean
  onClose: () => void
  onComplete: () => void
}

export default function FeatureTour({ isOpen, onClose, onComplete }: FeatureTourProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true)
      setCurrentStep(0)
    } else {
      setIsVisible(false)
    }
  }, [isOpen])

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      handleComplete()
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleComplete = () => {
    setIsVisible(false)
    onComplete()
    onClose()
  }

  const handleSkip = () => {
    setIsVisible(false)
    onClose()
  }

  if (!isVisible) return null

  const step = tourSteps[currentStep]
  const isLastStep = currentStep === tourSteps.length - 1

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg bg-white shadow-2xl border-0 relative">
        {/* Close button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleSkip}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
        >
          <X className="h-4 w-4" />
        </Button>

        <CardHeader className="text-center pb-4">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <step.icon className="w-8 h-8 text-blue-600" />
          </div>
          <CardTitle className="text-xl">{step.content.heading}</CardTitle>
          <CardDescription className="text-base">{step.description}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Step content */}
          <div className="space-y-3">
            {step.content.details.map((detail, index) => (
              <div key={index} className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 flex-shrink-0" />
                <p className="text-gray-700">{detail}</p>
              </div>
            ))}
          </div>

          {/* Tip */}
          {step.content.tip && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-blue-800 text-sm font-medium">
                💡 Tip: {step.content.tip}
              </p>
            </div>
          )}

          {/* Progress */}
          <div className="flex items-center justify-between">
            <div className="flex space-x-2">
              {tourSteps.map((_, index) => (
                <div
                  key={index}
                  className={`w-2 h-2 rounded-full ${
                    index === currentStep ? 'bg-blue-600' : 
                    index < currentStep ? 'bg-blue-300' : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>
            <Badge variant="outline" className="bg-white">
              {currentStep + 1} of {tourSteps.length}
            </Badge>
          </div>

          {/* Navigation */}
          <div className="flex justify-between pt-4">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStep === 0}
              className="flex items-center space-x-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Previous</span>
            </Button>

            <div className="flex space-x-2">
              <Button variant="ghost" onClick={handleSkip} className="text-gray-500">
                Skip Tour
              </Button>
              <Button
                onClick={handleNext}
                className="bg-blue-600 hover:bg-blue-700 flex items-center space-x-2"
              >
                <span>{isLastStep ? "Get Started" : "Next"}</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Hook for managing tour state
export function useFeatureTour() {
  const [showTour, setShowTour] = useState(false)
  const [hasCompletedTour, setHasCompletedTour] = useState(false)

  useEffect(() => {
    // Check if user has completed tour before
    const completed = localStorage.getItem('roundi-tour-completed')
    if (completed) {
      setHasCompletedTour(true)
    }
  }, [])

  const startTour = () => {
    setShowTour(true)
  }

  const closeTour = () => {
    setShowTour(false)
  }

  const completeTour = () => {
    setHasCompletedTour(true)
    localStorage.setItem('roundi-tour-completed', 'true')
    setShowTour(false)
  }

  const resetTour = () => {
    localStorage.removeItem('roundi-tour-completed')
    setHasCompletedTour(false)
  }

  return {
    showTour,
    hasCompletedTour,
    startTour,
    closeTour,
    completeTour,
    resetTour
  }
} 