"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";

export function Navbar() {
  return (
    <nav className="flex items-center justify-between px-8 py-6">
      <div className="flex items-center gap-2.5">
        <Image
          src="/white-roundi-logo.svg"
          alt="Roundi"
          width={120}
          height={40}
        />
      </div>

      {/* Nav links — hidden on small screens */}
      <div className="hidden md:flex items-center gap-8">
        <Link href="#" className="text-white/80 hover:text-white text-sm font-medium transition-colors">
          Home
        </Link>
        <Link href="#" className="text-white/80 hover:text-white text-sm font-medium transition-colors">
          For Businesses
        </Link>
        <Link href="#" className="text-white/80 hover:text-white text-sm font-medium transition-colors">
          About
        </Link>
        <Button
          asChild
          size="sm"
          className="rounded-full bg-[#C8E298] text-[#1a2e0f] hover:bg-[#b5d080] font-semibold px-5"
        >
          <Link href="#">Talk to Us</Link>
        </Button>
      </div>
    </nav>
  );
}
