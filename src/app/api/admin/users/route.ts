import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { getProfiles } from "@/lib/db";

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

export async function GET() {
  try {
    const keys = await redis.keys("user:*");

    const passcodes = new Set<string>();
    const keyCounts: Record<string, number> = {};
    const keyTypes: Record<string, string[]> = {};

    for (const key of keys) {
      const parts = key.split(":");
      if (parts.length >= 2 && parts[0] === "user") {
        const passcode = parts[1];
        if (!passcode) continue;

        passcodes.add(passcode);

        keyCounts[passcode] = (keyCounts[passcode] || 0) + 1;

        if (!keyTypes[passcode]) {
          keyTypes[passcode] = [];
        }
        keyTypes[passcode].push(parts.slice(2).join(":"));
      }
    }

    // Fetch profiles for each passcode to get their names
    const usersWithNames = await Promise.all(
      Array.from(passcodes).map(async (passcode) => {
        let names: string[] = [];
        try {
          // 1. Try standard route first (SavedProfile[])
          const profiles = await getProfiles(passcode);
          if (profiles && profiles.length > 0) {
            names = profiles
              .map((p) => p.name || `${p.firstName} ${p.lastName}`.trim())
              .filter(Boolean);
          }

          // 2. Try fd_personal_details if array is empty
          if (names.length === 0) {
            const pdKey = `user:${passcode}:fd:fd_personal_details`;
            const pdData: any = await redis.get(pdKey);
            if (pdData && (pdData.firstName || pdData.lastName)) {
              names.push(
                `${pdData.firstName || ""} ${pdData.lastName || ""}`.trim(),
              );
            }
          }

          // 3. Try fd_profiles if array is still empty
          if (names.length === 0) {
            const fdProfilesKey = `user:${passcode}:fd:fd_profiles`;
            const fdProfiles: any[] = (await redis.get(fdProfilesKey)) || [];
            if (Array.isArray(fdProfiles) && fdProfiles.length > 0) {
              names = fdProfiles
                .map(
                  (p) =>
                    p.name || `${p.firstName || ""} ${p.lastName || ""}`.trim(),
                )
                .filter(Boolean);
            }
          }
        } catch (e) {
          console.error(`Failed to fetch profiles for ${passcode}`, e);
        }

        return {
          passcode,
          names,
          keyCount: keyCounts[passcode],
          keys: keyTypes[passcode],
        };
      }),
    );

    // Sort by keyCount descending
    usersWithNames.sort((a, b) => (b.keyCount || 0) - (a.keyCount || 0));

    return NextResponse.json({ users: usersWithNames });
  } catch (error) {
    console.error("Failed to fetch users:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { passcode } = await request.json();

    if (!passcode) {
      return NextResponse.json(
        { error: "Passcode is required" },
        { status: 400 },
      );
    }

    const keys = await redis.keys(`user:${passcode}:*`);

    if (keys.length === 0) {
      return NextResponse.json({
        message: "No data found for this user",
        deletedCount: 0,
      });
    }

    // Delete all keys for this user
    const deletedCount = await redis.del(...keys);

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${deletedCount} keys for user ${passcode}`,
      deletedCount,
    });
  } catch (error) {
    console.error("Failed to delete user:", error);
    return NextResponse.json(
      { error: "Failed to delete user" },
      { status: 500 },
    );
  }
}
