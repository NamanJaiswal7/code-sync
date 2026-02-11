import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL; // e.g. https://server.com
        if (!socketUrl) {
            return NextResponse.json(
                { error: "Code execution service not configured (NEXT_PUBLIC_SOCKET_URL missing)" },
                { status: 503 }
            );
        }

        const body = await req.json();

        // forward to backend
        const response = await fetch(`${socketUrl}/execute`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });

        const data = await response.json();
        return NextResponse.json(data, { status: response.status });

    } catch (e: any) {
        console.error("Exec proxy error:", e);
        return NextResponse.json(
            { error: `Execution service unavailable: ${e.message}` },
            { status: 502 }
        );
    }
}
