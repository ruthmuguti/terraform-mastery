/**
 * GET /api/leaderboard — public, session optional.
 *
 * Returns a LeaderboardDTO. No authentication required; the viewer's session
 * is used only to populate the `me` field in the response.
 *
 * Feature: progress-sync
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getLeaderboard } from "@/lib/server/leaderboard";
import { jsonError } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const session = await auth();
    const userId = (session?.user as { id?: string } | undefined)?.id ?? undefined;

    const dto = await getLeaderboard(userId);

    // getLeaderboard catches its own DB errors and returns an empty DTO.
    // Treat an empty entries array as a sign that the DB is unavailable.
    if (dto.entries.length === 0) {
      return jsonError(
        503,
        "INTERNAL",
        "Leaderboard unavailable. Try again later.",
      );
    }

    return NextResponse.json(dto);
  } catch (err) {
    console.error("[leaderboard] Unexpected error:", err);
    return jsonError(503, "INTERNAL", "Leaderboard unavailable. Try again later.");
  }
}
