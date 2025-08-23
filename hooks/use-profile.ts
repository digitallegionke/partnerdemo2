import { useEffect, useState } from "react";
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

  useEffect(() => {
    const fetchProfile = async () => {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        console.error("No user", userError);
        setLoading(false);
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (profileError) {
        console.error("Error loading profile", profileError);
      } else {
        setProfile(profileData);
      }

      if (profileData.role === "owner") {
        const { data: orgData, error: orgError } = await supabase
          .from("organization")
          .select("*")
          .eq("user", user.id)
          .single();

        if (orgError || !orgData) {
          console.error("Error loading organization", orgError);
        }

        setOrganization(orgData);
        const { data: allPeople, error } = await supabase.rpc(
          "get_org_people",
          {
            p_org_id: orgData?.id,
          }
        );
        setTeam(allPeople);
        
      } else {
        const { data: memberRecord, error: memberError } = await supabase
          .from("organization_members")
          .select("organization:organization_id(*)")
          .eq("user_id", user.id)
          .single();

        if (memberError || !memberRecord) {
          console.error("Error loading organization", memberError);
        }

        if (
          memberRecord &&
          memberRecord.organization &&
          !Array.isArray(memberRecord.organization)
        ) {
          setOrganization(memberRecord.organization);
          const { data: allPeople, error } = await supabase.rpc(
            "get_org_people",
            {
              p_org_id: memberRecord.organization?.id,
            }
          );
          setTeam(allPeople);
          
        } else {
          setOrganization(null);
        }
      }

      setLoading(false);
    };

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
  }, []);

  return { profile, organization, loading, team };
}
