import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/db";
import { pickUsername } from "@/lib/server/username";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, password, provider = "aws" } = body;

    // Validate inputs
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Name, email, and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Validate provider
    if (!["aws", "gcp", "azure"].includes(provider)) {
      return NextResponse.json(
        { error: "Invalid provider. Must be aws, gcp, or azure" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await hash(password, 12);

    // Create user with credential
    const user = await prisma.user.create({
      data: {
        name,
        email,
        credential: {
          create: {
            password: passwordHash,
          },
        },
      },
    });

    // Create profile with username and provider
    const taken = await prisma.profile.findMany({
      where: {
        username: {
          startsWith: name.replace(/[^A-Za-z0-9_-]/g, "").toLowerCase().slice(0, 32),
        },
      },
      select: { username: true },
    });
    const username = pickUsername(name, new Set(taken.map((p) => p.username)));

    await prisma.profile.create({
      data: {
        userId: user.id,
        username,
        provider,
      },
    });

    return NextResponse.json({ success: true, userId: user.id });
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
