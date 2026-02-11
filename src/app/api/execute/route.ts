import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    // Code execution is temporarily disabled in production due to a build issue with 'tsx' dependency analysis in Next.js 16
    // TODO: Re-enable once the turbopack/tsx interaction is resolved.
    return NextResponse.json(
        {
            output: "",
            error: "Code execution is currently disabled in this environment.",
            exitCode: 1,
            timedOut: false
        },
        { status: 503 }
    );
}
