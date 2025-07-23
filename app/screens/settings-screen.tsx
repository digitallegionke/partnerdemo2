"use client"

import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function SettingsScreen() {
  return (
    <div className="p-6 bg-white space-y-6 max-w-2xl">
      <h2 className="text-2xl font-bold text-gray-900">Application Settings</h2>

      <Card className="bg-white border border-gray-200">
        <CardHeader>
          <CardTitle className="text-gray-900">Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="name" className="text-gray-700">
              Name
            </Label>
            <Input id="name" placeholder="Your full name" className="bg-white border-gray-300" />
          </div>
          <div>
            <Label htmlFor="email" className="text-gray-700">
              Email
            </Label>
            <Input id="email" type="email" placeholder="you@example.com" className="bg-white border-gray-300" />
          </div>
          <Button className="bg-blue-600 hover:bg-blue-700 text-white">Save Profile</Button>
        </CardContent>
      </Card>

      <Card className="bg-white border border-gray-200">
        <CardHeader>
          <CardTitle className="text-gray-900">Notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="email-notifs" className="text-gray-700">
              Email Notifications
            </Label>
            <Switch id="email-notifs" defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="sms-notifs" className="text-gray-700">
              SMS Notifications
            </Label>
            <Switch id="sms-notifs" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
