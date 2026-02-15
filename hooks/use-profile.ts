import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  full_name: string;
  avatar?: string;
  role: string;
  phone: string;
  email: string;
};

type Organization = {
  id: string;
  company_name: string;
  industry: string;
  team_size: string;
  company_phone: string;
  company_email: string;
  headquarters: string;
};

type Team = {
  id: string;
  type: "member" | "invite";
  role: string | null;
  joined_at: string | null;
  name: string | null;
  email: string
  invite_token: string | null;
  invite_created_at: string | null;
}

export function useUserProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [team, setTeam] = useState<Team[] | null>(null);

  const fetchProfile = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setLoading(false);
        return;
      }

      const res = await fetch("/api/profile", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        console.error("Error loading profile:", res.statusText);
        setLoading(false);
        return;
      }

      const data = await res.json();
      setProfile(data.profile || null);
      setOrganization(data.organization || null);
      setTeam(data.team || null);
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();

    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      fetchProfile();
    });

    const channel = supabase
      .channel("profile-changes")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
        },
        () => {
          fetchProfile();
        }
      )
      .subscribe();

    return () => {
      authListener.subscription.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [fetchProfile]);

  return { profile, organization, loading, team };
}
