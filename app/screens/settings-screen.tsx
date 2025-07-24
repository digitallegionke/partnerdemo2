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
  RotateCcw 
} from "lucide-react"
import { useFeatureTour } from "@/components/feature-tour"

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
    <div className="p-6 bg-white space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center">
          <Settings className="h-6 w-6 mr-2" />
          Settings
        </h2>
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
          Organization Admin
        </Badge>
      </div>

      {/* Profile Settings */}
      <Card className="bg-white border border-gray-200">
        <CardHeader>
          <CardTitle className="text-gray-900 flex items-center">
            <User className="h-5 w-5 mr-2" />
            Profile Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name" className="text-gray-700">Full Name</Label>
              <Input 
                id="name" 
                value={profileForm.name}
                onChange={(e) => setProfileForm({...profileForm, name: e.target.value})}
                className="bg-white border-gray-300" 
              />
            </div>
            <div>
              <Label htmlFor="email" className="text-gray-700">Email</Label>
              <Input 
                id="email" 
                type="email" 
                value={profileForm.email}
                onChange={(e) => setProfileForm({...profileForm, email: e.target.value})}
                className="bg-white border-gray-300" 
              />
            </div>
            <div>
              <Label htmlFor="phone" className="text-gray-700">Phone</Label>
              <Input 
                id="phone" 
                value={profileForm.phone}
                onChange={(e) => setProfileForm({...profileForm, phone: e.target.value})}
                className="bg-white border-gray-300" 
              />
            </div>
            <div>
              <Label htmlFor="role" className="text-gray-700">Role</Label>
              <Input 
                id="role" 
                value={profileForm.role}
                onChange={(e) => setProfileForm({...profileForm, role: e.target.value})}
                className="bg-white border-gray-300" 
              />
            </div>
          </div>
          <Button className="bg-blue-600 hover:bg-blue-700 text-white">Save Profile</Button>
        </CardContent>
      </Card>

      {/* Company Settings */}
      <Card className="bg-white border border-gray-200">
        <CardHeader>
          <CardTitle className="text-gray-900 flex items-center">
            <Globe className="h-5 w-5 mr-2" />
            Company Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="companyName" className="text-gray-700">Company Name</Label>
              <Input 
                id="companyName" 
                value={companyForm.name}
                onChange={(e) => setCompanyForm({...companyForm, name: e.target.value})}
                className="bg-white border-gray-300" 
              />
            </div>
            <div>
              <Label htmlFor="website" className="text-gray-700">Website</Label>
              <Input 
                id="website" 
                value={companyForm.website}
                onChange={(e) => setCompanyForm({...companyForm, website: e.target.value})}
                className="bg-white border-gray-300" 
              />
            </div>
            <div>
              <Label htmlFor="companyAddress" className="text-gray-700">Address</Label>
              <Input 
                id="companyAddress" 
                value={companyForm.address}
                onChange={(e) => setCompanyForm({...companyForm, address: e.target.value})}
                className="bg-white border-gray-300" 
              />
            </div>
            <div>
              <Label htmlFor="companyPhone" className="text-gray-700">Phone</Label>
              <Input 
                id="companyPhone" 
                value={companyForm.phone}
                onChange={(e) => setCompanyForm({...companyForm, phone: e.target.value})}
                className="bg-white border-gray-300" 
              />
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
            <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-green-600 hover:bg-green-700 text-white">
                  <Plus className="h-4 w-4 mr-2" />
                  Invite Member
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-white">
                <DialogHeader>
                  <DialogTitle>Invite Team Member</DialogTitle>
                  <DialogDescription>
                    Send an invitation to join your delivery team
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="inviteEmail">Email Address</Label>
                    <Input
                      id="inviteEmail"
                      type="email"
                      placeholder="john@example.com"
                      value={inviteForm.email}
                      onChange={(e) => setInviteForm({...inviteForm, email: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="inviteRole">Role</Label>
                    <Select value={inviteForm.role} onValueChange={(value) => setInviteForm({...inviteForm, role: value})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="driver">Driver</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="inviteMessage">Personal Message (Optional)</Label>
                    <Textarea
                      id="inviteMessage"
                      placeholder="Welcome to our team!"
                      value={inviteForm.message}
                      onChange={(e) => setInviteForm({...inviteForm, message: e.target.value})}
                    />
                  </div>
                  <div className="flex space-x-2">
                    <Button onClick={handleSendInvite} className="bg-blue-600 hover:bg-blue-700">
                      Send Invitation
                    </Button>
                    <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Driver Invitation Link */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-green-900 flex items-center">
                <UserPlus className="h-4 w-4 mr-2" />
                Driver Registration Link
              </h4>
              <Badge variant="outline" className="bg-white text-green-700 border-green-300">
                Public Link
              </Badge>
            </div>
            <p className="text-green-700 text-sm mb-3">
              Share this link with potential drivers to let them apply directly
            </p>
            <div className="flex items-center space-x-2">
              <Input 
                value={driverInviteLink} 
                readOnly 
                className="bg-white border-green-300 text-sm"
              />
              <Button 
                onClick={handleCopyLink} 
                variant="outline" 
                className="border-green-300 text-green-700 hover:bg-green-50"
              >
                {copiedLink ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Pending Invitations */}
          <div>
            <h4 className="font-semibold text-gray-900 mb-3">Pending Invitations</h4>
            <div className="space-y-3">
              {pendingInvites.map((invite) => (
                <div key={invite.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{invite.email}</p>
                    <p className="text-sm text-gray-500">
                      {invite.role} • Sent {invite.sentAt}
                    </p>
                  </div>
                  <Badge 
                    variant={invite.status === "accepted" ? "default" : "outline"}
                    className={invite.status === "accepted" ? "bg-green-100 text-green-800" : ""}
                  >
                    {invite.status}
                  </Badge>
                </div>
              ))}
            </div>
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
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-gray-700">Email Notifications</Label>
                <p className="text-sm text-gray-500">Receive updates via email</p>
              </div>
              <Switch 
                checked={notifications.email}
                onCheckedChange={(checked) => setNotifications({...notifications, email: checked})}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-gray-700">Push Notifications</Label>
                <p className="text-sm text-gray-500">Browser push notifications</p>
              </div>
              <Switch 
                checked={notifications.push}
                onCheckedChange={(checked) => setNotifications({...notifications, push: checked})}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-gray-700">SMS Alerts</Label>
                <p className="text-sm text-gray-500">Critical alerts via SMS</p>
              </div>
              <Switch 
                checked={notifications.sms}
                onCheckedChange={(checked) => setNotifications({...notifications, sms: checked})}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-gray-700">Delivery Updates</Label>
                <p className="text-sm text-gray-500">Status changes and completions</p>
              </div>
              <Switch 
                checked={notifications.deliveryUpdates}
                onCheckedChange={(checked) => setNotifications({...notifications, deliveryUpdates: checked})}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-gray-700">Driver Alerts</Label>
                <p className="text-sm text-gray-500">Driver status and performance</p>
              </div>
              <Switch 
                checked={notifications.driverAlerts}
                onCheckedChange={(checked) => setNotifications({...notifications, driverAlerts: checked})}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-gray-700">System Alerts</Label>
                <p className="text-sm text-gray-500">Maintenance and updates</p>
              </div>
              <Switch 
                checked={notifications.systemAlerts}
                onCheckedChange={(checked) => setNotifications({...notifications, systemAlerts: checked})}
              />
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
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Button 
              variant="outline" 
              onClick={handleStartTour}
              className="flex items-center justify-center space-x-2 border-gray-300"
            >
              <HelpCircle className="h-4 w-4" />
              <span>Take Feature Tour</span>
            </Button>
            <Button 
              variant="outline"
              onClick={handleResetOnboarding}
              className="flex items-center justify-center space-x-2 border-gray-300"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Reset Onboarding</span>
            </Button>
          </div>
          <div className="text-sm text-gray-600 space-y-2">
            <p><strong>Need help?</strong></p>
            <p>• Email: support@roundi.com</p>
            <p>• Phone: +254 700 123 456</p>
            <p>• Documentation: docs.roundi.com</p>
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card className="bg-white border border-gray-200">
        <CardHeader>
          <CardTitle className="text-gray-900 flex items-center">
            <Shield className="h-5 w-5 mr-2" />
            Security
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button variant="outline" className="border-gray-300">Change Password</Button>
          <Button variant="outline" className="border-gray-300">Two-Factor Authentication</Button>
          <Button variant="outline" className="border-red-300 text-red-600 hover:bg-red-50">
            Delete Account
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
