"use server";

import { supabase } from "@/lib/supabase";
import { redirect } from "next/navigation";

export async function signIn(prevState: any, formData: FormData) {
  if (!formData) {
    return { error: "Form data is missing" };
  }

  const email = formData.get("email");
  const password = formData.get("password");

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.toString(),
      password: password.toString(),
    });

    if (error) {
      return { error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Login error:", error);
    return { error: "An unexpected error occurred. Please try again." };
  }
}

export async function signUp(prevState: any, formData: FormData) {
  if (!formData) {
    return { error: "Form data is missing" };
  }

  const email = formData.get("email");
  const password = formData.get("password");

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  try {
    const { error } = await supabase.auth.signUp({
      email: email.toString(),
      password: password.toString(),
      options: {
        emailRedirectTo:
          process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ||
          `${
            process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
          }/auth/callback`,
      },
    });

    if (error) {
      return { error: error.message };
    }

    return { success: "Check your email to confirm your account." };
  } catch (error) {
    console.error("Sign up error:", error);
    return { error: "An unexpected error occurred. Please try again." };
  }
}

export async function acceptInviteWithSignup(
  prevState: any,
  formData: FormData
) {
  if (!formData) {
    return { error: "Form data is missing" };
  }

  const email = formData.get("email");
  const password = formData.get("password");
  const token = formData.get("token");
  const fullName = formData.get("fullName");
  const phoneNumber = formData.get("phoneNumber");

  if (!email || !password || !token || !fullName || !phoneNumber) {
    return { error: "Missing required fields" };
  }

  try {
    // First, verify the invite token
    const { data: invite, error: inviteError } = await supabase.rpc(
      "get_invite_by_token",
      {
        p_token: token,
      }
    );

    if (inviteError || !invite) {
      return { error: "Invalid or expired invite token" };
    }

    // Check if email matches the invite
    if (invite[0].email !== email.toString()) {
      return { error: "Email does not match the invited email address" };
    }

    // Create the user account
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email: email.toString(),
      password: password.toString(),
      options: {
        data: {
          full_name: fullName.toString() || "",
          phone: phoneNumber.toString(),
        },
      },
    });

    if (signUpError) {
      return { error: signUpError.message };
    }

    if (!authData.user) {
      return { error: "Failed to create user account" };
    }

    const { error: roleError } = await supabase
      .from("profiles")
      .update({ role: "member" })
      .eq("user_id", authData.user.id);

    if (roleError) {
      console.error("Error updating role:", roleError);
    }

    // Mark invite as used
    const { data: updateData, error: updateError } = await supabase.rpc(
      "use_invite_by_token",
      {
        p_token: token,
      }
    );

    if (updateError) {
      return { error: "Token has already been used." };
    }

    return {
      success:
        "Account created successfully! You will be automatically added to the organization.",
      organizationName: invite[0].organization_name || "the organization",
    };
  } catch (error) {
    console.error("Accept invite error:", error);
    return { error: "An unexpected error occurred. Please try again." };
  }
}

export async function signOut() {
  await supabase.auth.signOut();
  redirect("/");
}

export async function resetPassword(prevState: any, formData: FormData) {
  // Check if formData is valid
  if (!formData) {
    return { error: "Form data is missing" };
  }

  const email = formData.get("email");

  // Validate required fields
  if (!email) {
    return { error: "Email address is required" };
  }
  const redirectTo =
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(
      email.toString(),
      {
        redirectTo: `${redirectTo}/reset-password`,
      }
    );

    if (error) {
      return { error: error.message };
    }

    return {
      success:
        "Password reset link sent! Check your email for instructions to reset your password.",
    };
  } catch (error) {
    console.error("Password reset error:", error);
    return { error: "An unexpected error occurred. Please try again." };
  }
}

export async function updatePassword(prevState: any, formData: FormData) {
  // Check if formData is valid
  if (!formData) {
    return { error: "Form data is missing" };
  }

  const password = formData.get("password");
  const confirmPassword = formData.get("confirmPassword");

  // Validate required fields
  if (!password || !confirmPassword) {
    return { error: "Both password fields are required" };
  }

  // Check if passwords match
  if (password !== confirmPassword) {
    return { error: "Passwords do not match" };
  }

  // Check password length
  if (password.toString().length < 6) {
    return { error: "Password must be at least 6 characters long" };
  }

  try {
    

    const { error } = await supabase.auth.updateUser({
      password: password.toString(),
    });

    if (error) {
      return { error: error.message };
    }

    return {
      success: "Password updated successfully!",
    };
  } catch (error) {
    console.error("Password update error:", error);
    return { error: "An unexpected error occurred. Please try again." };
  }
}
