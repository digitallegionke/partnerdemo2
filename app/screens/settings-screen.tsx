"use client";

import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Trash2,
  EyeClosed,
  Eye,
} from "lucide-react";
import { useFeatureTour } from "@/components/feature-tour";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUserProfile } from "@/hooks/use-profile";
import { InviteModal } from "../components/invite-modal";
import { supabase } from "@/lib/supabase";
import { useAuth } from "../context/auth-context";
import { industries } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

export default function SettingsScreen() {
  const { profile, organization, loading, team } = useUserProfile();
  const [profileForm, setProfileForm] = useState({
    name: profile?.full_name,
    email: profile?.email,
    phone: profile?.phone,
    role: profile?.role,
  });

  const [companyForm, setCompanyForm] = useState({
    name: organization?.company_name,
    address: organization?.headquarters,
    industry: organization?.industry,
  });

  const [inviteForm, setInviteForm] = useState({
    email: "",
    role: "driver",
    message: "",
  });

  const [notifications, setNotifications] = useState({
    email: true,
    push: true,
    sms: false,
    deliveryUpdates: true,
    driverAlerts: true,
    systemAlerts: false,
  });

  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [copiedLink, setCopiedLink] = useState(true);

  const { startTour, resetTour } = useFeatureTour();

  useEffect(() => {
    if (organization?.industry) {
      setCompanyForm((prev) => ({
        ...prev,
        industry: organization.industry,
      }));
    }
  }, [organization]);

  const driverInviteLink =
    "https://roundi.com/onboarding/driver?token=abc123xyz";

  const updateUserProfile = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authHeader = session?.access_token ? `Bearer ${session.access_token}` : '';

      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": authHeader,
        },
        body: JSON.stringify({
          name: profileForm.name,
          phone: profileForm.phone,
          email: profileForm.email,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        toast({
          title: "Error",
          description: result.error || "Failed to update profile",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Profile updated",
        description: "Your profile has been saved.",
      });
    } catch (error) {
      console.error("Error updating profile:", error);
      toast({
        title: "Error",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    }
  };

  const updateUserOrganization = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authHeader = session?.access_token ? `Bearer ${session.access_token}` : '';

      const res = await fetch("/api/profile/organization", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": authHeader,
        },
        body: JSON.stringify({
          company_name: companyForm.name,
          headquarters: companyForm.address,
          industry: companyForm.industry,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        toast({
          title: "Error",
          description: result.error || "Failed to update organization",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Company info updated",
        description: "Organization details have been saved.",
      });
    } catch (error) {
      console.error("Error updating organization:", error);
      toast({
        title: "Error",
        description: "Failed to update organization. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(driverInviteLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleSendInvite = () => {
    // TODO: Implement invite sending logic

    setInviteDialogOpen(false);
    setInviteForm({ email: "", role: "driver", message: "" });
  };

  const handleStartTour = () => {
    startTour();
  };

  const handleResetOnboarding = () => {
    localStorage.removeItem("roundi-has-visited");
    localStorage.removeItem("roundi-tour-completed");
    resetTour();

    window.location.reload();
  };

  function getInitials(name?: string) {
    if (!name) return "??";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  }

  const handlePasswordChange = async () => {
    if (newPassword !== confirmNewPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match!",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 8) {
      toast({ title: "Error", description: "Password must be at least 8 characters long", variant: "destructive" });
      return;
    }
    if (!/[A-Z]/.test(newPassword)) {
      toast({ title: "Error", description: "Password must contain at least one uppercase letter", variant: "destructive" });
      return;
    }
    if (!/[a-z]/.test(newPassword)) {
      toast({ title: "Error", description: "Password must contain at least one lowercase letter", variant: "destructive" });
      return;
    }
    if (!/[0-9]/.test(newPassword)) {
      toast({ title: "Error", description: "Password must contain at least one number", variant: "destructive" });
      return;
    }

    const { data, error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      console.error("Error changing password:", error.message);
      toast({
        title: "Error",
        description: `Error changing password: ${error.message}`,
        variant: "destructive",
      });
      return { success: false, error: error.message };
    }

    toast({
      title: "Success!",
      description: `Password reset.`,
    });

    setNewPassword("");
    setConfirmNewPassword("");
    setShowPasswordForm(false);

    return { success: true, data };
  };

  return (
    <div className="p-6 bg-white">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">
          Manage your account, team, and app preferences
        </p>
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
                <AvatarImage src={profile?.avatar} />
                <AvatarFallback className="bg-gray-100 text-gray-600 text-lg">
                  {" "}
                  {getInitials(profile?.full_name)}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-semibold text-gray-900">
                  {profile?.full_name}
                </h3>
                <p className="text-sm text-gray-500">{profile?.role}</p>
                <Button variant="outline" size="sm" className="mt-2">
                  Change Photo
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="fullName" className="text-gray-700">
                  Full Name
                </Label>
                <Input
                  id="fullName"
                  defaultValue={profile?.full_name}
                  value={profileForm?.name}
                  className="bg-white border-gray-300"
                  onChange={(e) =>
                    setProfileForm((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                />
              </div>

              <div>
                <Label htmlFor="email" className="text-gray-700">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  defaultValue={profile?.email}
                  value={profileForm?.email}
                  onChange={(e) =>
                    setProfileForm((prev) => ({
                      ...prev,
                      email: e.target.value,
                    }))
                  }
                  className="bg-white border-gray-300"
                />
              </div>
              <div>
                <Label htmlFor="phone" className="text-gray-700">
                  Phone
                </Label>
                <Input
                  id="phone"
                  defaultValue={profile?.phone}
                  value={profileForm.phone}
                  onChange={(e) =>
                    setProfileForm((prev) => ({
                      ...prev,
                      phone: e.target.value,
                    }))
                  }
                  type="tel"
                  className="bg-white border-gray-300"
                />
              </div>
            </div>
            <Button
              className="bg-[#C8E298] hover:bg-[#C8E298]/90 text-[#162318] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#162318] transition-colors duration-200"
              onClick={updateUserProfile}
            >
              Save Profile
            </Button>


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
                <Label htmlFor="companyName" className="text-gray-700">
                  Company Name
                </Label>
                <Input
                  id="companyName"
                  defaultValue={organization?.company_name}
                  value={companyForm.name}
                  className="bg-white border-gray-300"
                  onChange={(e) =>
                    setCompanyForm((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                  disabled={profile?.role !== "owner"}
                />
              </div>
              <div>
                <Label htmlFor="industry" className="text-gray-700">
                  Industry
                </Label>
                <Select
                  value={companyForm.industry}
                  onValueChange={(val) =>
                    setCompanyForm((prev) => ({ ...prev, industry: val }))
                  }
                  disabled={profile?.role !== "owner"}
                >
                  <SelectTrigger className="bg-white border-gray-300">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {industries.map((ind) => (
                      <SelectItem key={ind.value} value={ind.value}>
                        {ind.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="address" className="text-gray-700">
                  Address
                </Label>
                <Input
                  id="address"
                  defaultValue={organization?.headquarters}
                  value={companyForm.address}
                  onChange={(e) =>
                    setCompanyForm((prev) => ({
                      ...prev,
                      address: e.target.value,
                    }))
                  }
                  className="bg-white border-gray-300"
                  disabled={profile?.role !== "owner"}
                />
              </div>
            </div>
            {profile?.role === "owner" && (
              <Button
                className="bg-[#C8E298] hover:bg-[#C8E298] text-[#162318]"
                onClick={updateUserOrganization}
              >
                Save Company Info
              </Button>

            )}
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
              {profile?.role === "owner" && (
                <Button
                  size="sm"
                  className="bg-[#C8E298] hover:bg-[#C8E298] text-[#162318]"
                  onClick={() => setInviteDialogOpen(true)}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite User
                </Button>

              )}
              {inviteDialogOpen && (
                <InviteModal
                  isOpen={inviteDialogOpen}
                  setIsOpen={setInviteDialogOpen}
                />
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {team?.map((user, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-gray-200 text-gray-600 text-sm">
                        {(user?.name ?? user?.email)
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-gray-900">
                        {user.name || user.email?.[0]?.toUpperCase()}
                      </p>
                      <p className="text-sm text-gray-500">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge
                      variant={user.type === "member" ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {user.type === "member" ? "Active" : "Pending"}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {user.type === "member" ? user.role : "invited"}
                    </Badge>
                    {profile?.role === "owner" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-gray-400"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        {/* <Card className="bg-white border border-gray-200">
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
                  <Label htmlFor="emailNotifications" className="text-gray-700">
                    Email Notifications
                  </Label>
                  <p className="text-sm text-gray-500">
                    Receive delivery updates via email
                  </p>
                </div>
                <Switch id="emailNotifications" defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="smsNotifications" className="text-gray-700">
                    SMS Notifications
                  </Label>
                  <p className="text-sm text-gray-500">
                    Get urgent notifications via SMS
                  </p>
                </div>
                <Switch id="smsNotifications" />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="pushNotifications" className="text-gray-700">
                    Push Notifications
                  </Label>
                  <p className="text-sm text-gray-500">
                    Browser push notifications
                  </p>
                </div>
                <Switch id="pushNotifications" defaultChecked />
              </div>
            </div>
            <Button className="bg-[#C8E298] hover:bg-[#274690] text-white">
              Save Preferences
            </Button>
          </CardContent>
        </Card> */}

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
              <Button
                variant="outline"
                className="h-16 flex flex-col items-center justify-center border-gray-300 hover:bg-gray-50"
              >
                <FileText className="h-5 w-5 mb-1" />
                Documentation
              </Button>
              <Button
                variant="outline"
                className="h-16 flex flex-col items-center justify-center border-gray-300 hover:bg-gray-50"
              >
                <MessageSquare className="h-5 w-5 mb-1" />
                Contact Support
              </Button>
              <Button
                variant="outline"
                className="h-16 flex flex-col items-center justify-center border-gray-300 hover:bg-gray-50"
              >
                <Phone className="h-5 w-5 mb-1" />
                Call: +254 722 235 314
              </Button>
              <Button
                asChild
                variant="outline"
                className="h-16 flex flex-col items-center justify-center border-gray-300 hover:bg-gray-50"
              >
                <a href="mailto:support@roundi.africa">
                  <Mail className="h-5 w-5 mb-1" />
                  Email Support
                </a>
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
                  <Label className="text-gray-700">
                    Two-Factor Authentication
                  </Label>
                  <p className="text-sm text-gray-500">
                    Add extra security to your account
                  </p>
                </div>
                <Button variant="outline" size="sm" disabled>
                  Enable
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-gray-700">Password</Label>
                  <p className="text-sm text-gray-500">
                    Last changed 3 months ago
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPasswordForm(!showPasswordForm)}
                >
                  Change Password
                </Button>
              </div>

              {showPasswordForm && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handlePasswordChange();
                  }}
                  className="space-y-3 p-4 bg-gray-50 rounded-lg"
                >
                  <div className="relative">
                    <Label htmlFor="new-password">New Password</Label>
                    <Input
                      id="new-password"
                      type={showPassword ? "text" : "password"}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                    />
                    <Button
                      className="absolute right-3 top-1/4 h-full px-3 py-2 text-gray-400 bg-transparent hover:bg-transparent"
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

                  <div className="relative">
                    <Label htmlFor="confirm-password">
                      Confirm New Password
                    </Label>
                    <Input
                      id="confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      required
                    />
                    <Button
                      className="absolute right-3 top-1/4 h-full px-3 py-2 text-gray-400 bg-transparent hover:bg-transparent"
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
                  <div className="flex space-x-2">
                    <Button type="submit" size="sm">
                      Update Password
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowPasswordForm(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              )}
            </div>
            <Button variant="destructive" className="w-full" disabled>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Account
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
