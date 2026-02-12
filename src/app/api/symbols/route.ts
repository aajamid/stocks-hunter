import { NextResponse } from "next/server"

import { fetchSymbolsList } from "@/lib/queries"

export async function GET() {
  try {
    const data = await fetchSymbolsList()
    return NextResponse.json(data)
  } catch (error) {
    console.error("symbols api error", error)
    return NextResponse.json(
      { error: "Failed to load symbols metadata." },
      { status: 500 }
    )
  }
}
