import { NextRequest, NextResponse } from "next/server"
import { AuthService } from "@/lib/services/auth"

export async function POST(req: NextRequest) {
  try {
    const result = await AuthService.signOut()

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        message: "Signed out successfully",
      },
      { status: 200 }
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Server error"
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
