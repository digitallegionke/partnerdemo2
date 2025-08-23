"use client";

import type React from "react";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { Mail, Send, UserPlus } from "lucide-react";
import { useUserProfile } from "@/hooks/use-profile";

export interface InviteModalProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export function InviteModal({ isOpen, setIsOpen }: InviteModalProps) {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
 
  const { toast } = useToast();
  const { organization } = useUserProfile();

  const generateInviteToken = () => {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      toast({
        title: "Error",
        description: "Please enter an email address",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const inviteToken = generateInviteToken();
      const inviteLink = `${window.location.origin}/accept-invite?token=${inviteToken}`;
      const user = (await supabase.auth.getUser()).data.user;
      
      const { error } = await supabase!.from("invites").insert([
        {
          email,
          invite_token: inviteToken,
          used: false,
          invited_by: user!.id,
          organization_id: organization!.id,
        },
      ]);

      if (error) {
        toast({
          title: "Error",
          description: "Failed to send invite. Please try again.",
          variant: "destructive",
        });
        return;
      }

      const res = await fetch("/api/send-team-invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          inviteLink,
        }),
      });

      if (!res.ok) {
        toast({
          title: "Error",
          description: "Failed to send invite. Please try again.",
          variant: "destructive",
        });
        console.error("Failed to send invite:", await res.text());
      } else {
        toast({
          title: "Invite sent!",
          description: `Invite link: ${inviteLink}`,
        });
      }

      setEmail("");
      setIsOpen(false);
    } catch (error) {
      console.error("Error sending invite:", error);
      toast({
        title: "Error",
        description: "Failed to send invite. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Invite User
          </DialogTitle>
          <DialogDescription>
            Enter an email address to send an invitation link.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSendInvite} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} className="gap-2">
              {isLoading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Send Invite
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
