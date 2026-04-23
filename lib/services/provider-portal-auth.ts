import { supabase } from "@/lib/supabase";

export interface ProviderAccessProfile {
  userId: string;
  email: string | null;
  providerId: number;
  providerName: string;
  providerStatus: "pending" | "active" | "suspended";
  role: string;
}

export async function getProviderAccessProfile(): Promise<ProviderAccessProfile | null> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) return null;

  const { data: membership, error: membershipError } = await supabase
    .from("partner_provider_users")
    .select("provider_id, role, is_active")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (membershipError || !membership) return null;

  const { data: provider, error: providerError } = await supabase
    .from("partner_providers")
    .select("id, provider_name, status")
    .eq("id", membership.provider_id)
    .maybeSingle();

  if (providerError || !provider) return null;

  return {
    userId: user.id,
    email: user.email ?? null,
    providerId: provider.id,
    providerName: provider.provider_name,
    providerStatus: provider.status,
    role: membership.role,
  };
}

export async function signOutProviderUser(): Promise<void> {
  await supabase.auth.signOut();
}
