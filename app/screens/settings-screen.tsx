"use client"

import { useState } from "react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  Settings, 
  User, 
  Users, 
  Bell, 
  Globe, 
  Shield, 
  Mail, 
  Plus, 
  Copy, 
  Check, 
  UserPlus,
  HelpCircle,
  RotateCcw,
  Building,
  MoreVertical,
  FileText,
  MessageSquare,
  Phone,
  Trash2
} from "lucide-react"
import { useFeatureTour } from "@/components/feature-tour"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export default function SettingsScreen() {
  const [profileForm, setProfileForm] = useState({
    name: "David Manager",
    email: "david@roundi.com",
    phone: "+254 712 345 678",
    role: "Operations Lead"
  })

  const [companyForm, setCompanyForm] = useState({
    name: "Acme Delivery Co.",
    address: "Nairobi, Kenya",
    phone: "+254 700 123 456",
    website: "www.acmedelivery.co.ke"
  })

  const [inviteForm, setInviteForm] = useState({
    email: "",
    role: "driver",
    message: ""
  })

  const [notifications, setNotifications] = useState({
    email: true,
    push: true,
    sms: false,
    deliveryUpdates: true,
    driverAlerts: true,
    systemAlerts: false
  })

  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)

  const { startTour, resetTour } = useFeatureTour()

  const driverInviteLink = "https://roundi.com/onboarding/driver?token=abc123xyz"

  const pendingInvites = [
    { id: 1, email: "john@example.com", role: "driver", status: "pending", sentAt: "2024-01-15" },
    { id: 2, email: "sarah@example.com", role: "driver", status: "accepted", sentAt: "2024-01-14" },
    { id: 3, email: "mike@example.com", role: "admin", status: "pending", sentAt: "2024-01-13" },
  ]

  const handleCopyLink = () => {
    navigator.clipboard.writeText(driverInviteLink)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  const handleSendInvite = () => {
    // TODO: Implement invite sending logic
    console.log("Sending invite:", inviteForm)
    setInviteDialogOpen(false)
    setInviteForm({ email: "", role: "driver", message: "" })
  }

  const handleStartTour = () => {
    startTour()
  }

  const handleResetOnboarding = () => {
    localStorage.removeItem('roundi-has-visited')
    localStorage.removeItem('roundi-tour-completed')
    resetTour()
    // Refresh the page to trigger first-time flow
    window.location.reload()
  }

  return (
    <div className="p-6 bg-white">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">Manage your account, team, and app preferences</p>
      </div>

      <div className="max-w-4xl mx-auto space-y-8">
        {/* Profile Settings */}
        <Card className="bg-white border border-gray-200">
          <CardHeader>
            <CardTitle className="text-gray-900 flex items-center">
              <User className="h-5 w-5 mr-2" />
              Profile Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src="/placeholder.svg?height=64&width=64" />
                <AvatarFallback className="bg-gray-100 text-gray-600 text-lg">DM</AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-semibold text-gray-900">David Manager</h3>
                <p className="text-sm text-gray-500">Operations Lead</p>
                <Button variant="outline" size="sm" className="mt-2">
                  Change Photo
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName" className="text-gray-700">First Name</Label>
                <Input id="firstName" defaultValue="David" className="bg-white border-gray-300" />
              </div>
              <div>
                <Label htmlFor="lastName" className="text-gray-700">Last Name</Label>
                <Input id="lastName" defaultValue="Manager" className="bg-white border-gray-300" />
              </div>
              <div>
                <Label htmlFor="email" className="text-gray-700">Email</Label>
                <Input id="email" type="email" defaultValue="david@roundi.co" className="bg-white border-gray-300" />
              </div>
              <div>
                <Label htmlFor="phone" className="text-gray-700">Phone</Label>
                <Input id="phone" defaultValue="+254 712 345 678" className="bg-white border-gray-300" />
              </div>
            </div>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white">Save Profile</Button>
          </CardContent>
        </Card>

        {/* Company Settings */}
        <Card className="bg-white border border-gray-200">
          <CardHeader>
            <CardTitle className="text-gray-900 flex items-center">
              <Building className="h-5 w-5 mr-2" />
              Company Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="companyName" className="text-gray-700">Company Name</Label>
                <Input id="companyName" defaultValue="Roundi Logistics" className="bg-white border-gray-300" />
              </div>
              <div>
                <Label htmlFor="industry" className="text-gray-700">Industry</Label>
                <Select defaultValue="logistics">
                  <SelectTrigger className="bg-white border-gray-300">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="logistics">Logistics & Transportation</SelectItem>
                    <SelectItem value="ecommerce">E-commerce</SelectItem>
                    <SelectItem value="food">Food & Beverage</SelectItem>
                    <SelectItem value="retail">Retail</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="address" className="text-gray-700">Address</Label>
                <Input id="address" defaultValue="123 Logistics Avenue, Nairobi, Kenya" className="bg-white border-gray-300" />
              </div>
            </div>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white">Save Company Info</Button>
          </CardContent>
        </Card>

        {/* Team Management */}
        <Card className="bg-white border border-gray-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-gray-900 flex items-center">
                <Users className="h-5 w-5 mr-2" />
                Team Management
              </CardTitle>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                <UserPlus className="h-4 w-4 mr-2" />
                Invite User
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { name: "David Manager", role: "Admin", email: "david@roundi.co", status: "Active" },
                { name: "Sarah Johnson", role: "Manager", email: "sarah@roundi.co", status: "Active" },
                { name: "Mike Wilson", role: "Driver", email: "mike@roundi.co", status: "Pending" },
              ].map((user, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-gray-200 text-gray-600 text-sm">
                        {user.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-gray-900">{user.name}</p>
                      <p className="text-sm text-gray-500">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant={user.status === "Active" ? "default" : "secondary"} className="text-xs">
                      {user.status}
                    </Badge>
                    <Badge variant="outline" className="text-xs">{user.role}</Badge>
                    <Button variant="ghost" size="sm" className="text-gray-400">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card className="bg-white border border-gray-200">
          <CardHeader>
            <CardTitle className="text-gray-900 flex items-center">
              <Bell className="h-5 w-5 mr-2" />
              Notification Preferences
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="emailNotifications" className="text-gray-700">Email Notifications</Label>
                  <p className="text-sm text-gray-500">Receive delivery updates via email</p>
                </div>
                <Switch id="emailNotifications" defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="smsNotifications" className="text-gray-700">SMS Notifications</Label>
                  <p className="text-sm text-gray-500">Get urgent notifications via SMS</p>
                </div>
                <Switch id="smsNotifications" />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="pushNotifications" className="text-gray-700">Push Notifications</Label>
                  <p className="text-sm text-gray-500">Browser push notifications</p>
                </div>
                <Switch id="pushNotifications" defaultChecked />
              </div>
            </div>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white">Save Preferences</Button>
          </CardContent>
        </Card>

        {/* Help & Support */}
        <Card className="bg-white border border-gray-200">
          <CardHeader>
            <CardTitle className="text-gray-900 flex items-center">
              <HelpCircle className="h-5 w-5 mr-2" />
              Help & Support
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button variant="outline" className="h-16 flex flex-col items-center justify-center border-gray-300 hover:bg-gray-50">
                <FileText className="h-5 w-5 mb-1" />
                Documentation
              </Button>
              <Button variant="outline" className="h-16 flex flex-col items-center justify-center border-gray-300 hover:bg-gray-50">
                <MessageSquare className="h-5 w-5 mb-1" />
                Contact Support
              </Button>
              <Button variant="outline" className="h-16 flex flex-col items-center justify-center border-gray-300 hover:bg-gray-50">
                <Phone className="h-5 w-5 mb-1" />
                Call: +254 712 345 678
              </Button>
              <Button variant="outline" className="h-16 flex flex-col items-center justify-center border-gray-300 hover:bg-gray-50">
                <Mail className="h-5 w-5 mb-1" />
                Email Support
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Security */}
        <Card className="bg-white border border-gray-200">
          <CardHeader>
            <CardTitle className="text-gray-900 flex items-center">
              <Shield className="h-5 w-5 mr-2" />
              Security & Privacy
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-gray-700">Two-Factor Authentication</Label>
                  <p className="text-sm text-gray-500">Add extra security to your account</p>
                </div>
                <Button variant="outline" size="sm">Enable</Button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-gray-700">Password</Label>
                  <p className="text-sm text-gray-500">Last changed 3 months ago</p>
                </div>
                <Button variant="outline" size="sm">Change Password</Button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-gray-700">API Keys</Label>
                  <p className="text-sm text-gray-500">Manage integration keys</p>
                </div>
                <Button variant="outline" size="sm">Manage Keys</Button>
              </div>
            </div>
            <Button variant="destructive" className="w-full">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Account
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
