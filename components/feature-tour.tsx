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
    id: "control-center",
    title: "Your Control Center",
    description: "All-in-one delivery dashboard",
    icon: Route,
    target: "sidebar",
    placement: "right",
    content: {
      heading: "Your Control Center",
      details: [
        "Manage every order, driver, and route in one place",
        "Track deliveries in real time on an interactive map",
        "Boost efficiency with built-in AI tools"
      ],
      tip: "Use the sidebar to quickly switch between sections"
    }
  },
  {
    id: "route-planning",
    title: "Smart Route Planning",
    description: "Plan and assign deliveries with ease",
    icon: Route,
    target: "routes-section",
    placement: "bottom",
    content: {
      heading: "Smart Route Planning",
      details: [
        "Create routes with simple start and end points",
        "Assign drivers to the right routes instantly",
        "View delivery progress in real time",
        "Optimize routes for speed and reliability"
      ],
      tip: "Click 'Add Route' to start planning your first delivery"
    }
  },
  {
    id: "delivery-team",
    title: "Your Delivery Team",
    description: "Keep your drivers connected",
    icon: Users,
    target: "drivers-section", 
    placement: "bottom",
    content: {
      heading: "Your Delivery Team",
      details: [
        "View drivers and their availability at a glance",
        "Add and onboard new team members easily",
        "Monitor driver performance and efficiency",
        "Assign drivers to specific deliveries in seconds"
      ],
      tip: "Green status = driver is active and ready"
    }
  },
  {
    id: "track-everything",
    title: "Track Everything",
    description: "Stay on top of every delivery",
    icon: MapPin,
    target: "deliveries-section",
    placement: "bottom", 
    content: {
      heading: "Track Everything",
      details: [
        "Monitor delivery status from start to finish",
        "Update delivery progress in real time",
        "See live driver locations on the map",
        "Collect customer feedback and ratings"
      ],
      tip: "Use filters to quickly find specific deliveries"
    }
  },
  {
    id: "data-insights",
    title: "Data-Driven Insights",
    description: "Turn data into smarter decisions",
    icon: BarChart3,
    target: "analytics-section",
    placement: "bottom",
    content: {
      heading: "Data-Driven Insights",
      details: [
        "Track delivery times, costs, and delays",
        "Measure driver efficiency and performance",
        "Spot opportunities to save time and fuel",
        "Share reports with your team and stakeholders"
      ],
      tip: "Check analytics often to keep improving"
    }
  },
  {
    id: "smart-optimization",
    title: "Smart Optimization",
    description: "AI-powered delivery optimization",
    icon: Settings,
    target: "optimize-section", 
    placement: "bottom",
    content: {
      heading: "Smart Optimization",
      details: [
        "Automatically plan the fastest routes",
        "Factor in traffic, distance, and driver load",
        "Reduce fuel costs and save time",
        "Apply optimizations with one click"
      ],
      tip: "Run optimizations daily for best results"
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