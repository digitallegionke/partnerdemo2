"use client";
import { useEffect } from "react";
import { useAuth } from "@/app/context/auth-context";
import { useRouter } from "next/navigation";

export const RequireAuth = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
    }
  }, [loading, user, router]);

   if (loading) {
     return <div>Loading...</div>;
   }

   if (!user) {
     return <div>Please login to proceed. Redirecting ...</div>;
   }

  return <>{children}</>;
};
