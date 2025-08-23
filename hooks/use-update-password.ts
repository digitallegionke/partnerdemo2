"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase"; 

export function useUpdatePassword() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const updatePassword = async (password: string, confirmPassword: string) => {
    setError(null);
    setSuccess(null);

    if (!password || !confirmPassword) {
      setError("Both password fields are required");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(error.message);
    } else {
      setSuccess("Password updated successfully! You can now log in.");
    }

    setLoading(false);
  };

  return { updatePassword, loading, error, success };
}
