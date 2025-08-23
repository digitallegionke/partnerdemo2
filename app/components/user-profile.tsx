import React from "react";
import { useUserProfile } from "@/hooks/use-profile";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const UserProfile = () => {
  const { profile, loading } = useUserProfile();

  return (
    <div className="flex items-center space-x-2">
      <Avatar className="h-8 w-8">
        <AvatarImage
          src={profile?.avatar}
          alt={profile?.full_name || "User"}
        />
        <AvatarFallback className="bg-gray-100 text-gray-600">
          {profile?.full_name
            ?.split(" ")
            .map((name) => name[0])
            .join("") || "??"}
        </AvatarFallback>
      </Avatar>
      <div className="hidden md:block">
        <p className="text-sm font-medium text-gray-900">
          {profile?.full_name}
        </p>
        <p className="text-xs text-gray-500">{profile?.role || "User"}</p>
      </div>
    </div>
  );
};

export default UserProfile;
