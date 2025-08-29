"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { CheckCircle, XCircle, Loader2, UserPlus } from "lucide-react";
import { acceptInviteWithSignup } from "@/lib/actions";
import Link from "next/link";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Creating Account...
        </>
      ) : (
        <>
          <UserPlus className="mr-2 h-4 w-4" />
          Accept Invite & Create Account
        </>
      )}
    </Button>
  );
}

export default function AcceptInvite() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<
    "loading" | "valid" | "invalid" | "used"
  >("loading");
  const [inviteData, setInviteData] = useState<any>(null);
  const [state, formAction] = useActionState(acceptInviteWithSignup, null);

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }

    checkInvite();
  }, [token]);

  const checkInvite = async () => {
    try {
      const { data, error } = await supabase.rpc("get_invite_by_token", {
        p_token: token,
      });
      
      if (error || !data) {
        setStatus("invalid");
        return;
      }

      if (data.used || data.length === 0 && !error) {
        setStatus("used");
        return;
      }

      setInviteData(data[0]);
      setStatus("valid");
    } catch (error) {
      console.error("Error checking invite:", error);
      setStatus("invalid");
    }
  };
 
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            <UserPlus className="h-5 w-5" />
            Join Organization
          </CardTitle>
          <CardDescription>
            {status === "loading" && "Verifying your invitation..."}
            {status === "valid" &&
              `You've been invited to join ${
                inviteData?.organization_name || "an organization"
              }`}
            {status === "invalid" && "Invalid invitation link"}
            {status === "used" && "This invitation has already been used"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "loading" && (
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-500" />
            </div>
          )}

          {status === "valid" && (
            <form action={formAction} className="space-y-4">
              <input type="hidden" name="token" value={token || ""} />

              {state?.error && (
                <div className="bg-red-500/10 border border-red-500/50 text-red-700 dark:text-red-400 px-4 py-3 rounded text-sm">
                  {state.error}
                </div>
              )}

              {state?.success && (
                <div className="bg-green-500/10 border border-green-500/50 text-green-700 dark:text-green-400 px-4 py-3 rounded text-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="h-4 w-4" />
                    <span className="font-medium">Success!</span>
                  </div>
                  {state.success}
                  {state.organizationName && (
                    <p className="mt-2 text-xs opacity-80">
                      Organization: {state.organizationName}
                    </p>
                  )}

                  <p className="text-gray-600">
                    Proceed to{" "}
                    <Link
                      href="/"
                      className="text-blue-600 hover:underline font-medium"
                    >
                      login
                    </Link>
                  </p>
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="email" className="block text-sm font-medium">
                    Email Address
                  </label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    defaultValue={inviteData?.email || ""}
                    readOnly
                    className="bg-slate-50 dark:bg-slate-800"
                  />
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    This email was invited to join the organization
                  </p>
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="fullName"
                    className="block text-sm font-medium"
                  >
                    Full Name
                  </label>
                  <Input
                    id="fullName"
                    name="fullName"
                    type="text"
                    placeholder="Enter your full name"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium"
                  >
                    Password
                  </label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="Create a secure password"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="phoneNumber"
                    className="block text-sm font-medium"
                  >
                    Phone Number
                  </label>
                  <Input
                    id="phoneNumber"
                    name="phoneNumber"
                    type="tel"
                    placeholder="254712345678"
                    required
                  />
                </div>
              </div>

              <SubmitButton />

              <div className="text-center text-xs text-slate-600 dark:text-slate-400">
                By creating an account, you'll be added as a member to{" "}
                <span className="font-medium">
                  {inviteData?.organization_name || "the organization"}
                </span>
              </div>
            </form>
          )}

          {status === "invalid" && (
            <div className="text-center space-y-4">
              <XCircle className="h-8 w-8 mx-auto text-red-500" />
              <p className="text-sm text-slate-600 dark:text-slate-400">
                This invitation link is not valid or has expired.
              </p>
            </div>
          )}

          {status === "used" && (
            <div className="text-center space-y-4">
              <XCircle className="h-8 w-8 mx-auto text-orange-500" />
              <p className="text-sm text-slate-600 dark:text-slate-400">
                This invitation has already been accepted.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
