import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { USER_COLORS } from "@/lib/types";

// POST /api/auth/register
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { name, email } = body;

        if (!name || !email) {
            return NextResponse.json(
                { error: "name and email are required" },
                { status: 400 }
            );
        }

        // check if user exists
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            // just return the existing user, not strict about auth for this demo
            return NextResponse.json(existing);
        }

        // pick a random color
        const color = USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)];

        const user = await prisma.user.create({
            data: {
                name,
                email,
                password: "demo", // not doing real auth for this project
                avatarColor: color,
            },
        });

        return NextResponse.json(user, { status: 201 });
    } catch (error: any) {
        console.error("auth error:", error);
        return NextResponse.json(
            { error: `Auth failed: ${error.message || "Unknown error"}` },
            { status: 500 }
        );
    }
}
