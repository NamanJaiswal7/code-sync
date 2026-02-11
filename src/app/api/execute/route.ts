import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { writeFile, unlink, mkdtemp } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

const TIMEOUT_MS = 10_000; // 10 seconds max
const MAX_OUTPUT_BYTES = 50 * 1024; // 50KB cap

interface ExecuteRequest {
    code: string;
    language: string;
}

interface ExecuteResponse {
    output: string;
    error: string;
    exitCode: number | null;
    timedOut: boolean;
}

function getFileExtension(language: string): string {
    switch (language) {
        case "javascript": return ".js";
        case "typescript": return ".ts";
        case "python": return ".py";
        default: return ".js";
    }
}

function getCommand(language: string, filePath: string): { cmd: string; args: string[] } {
    switch (language) {
        case "javascript":
            return { cmd: "node", args: [filePath] };
        case "typescript":
            // tsx is already a dependency in this project
            return { cmd: "npx", args: ["tsx", filePath] };
        case "python":
            return { cmd: "python3", args: [filePath] };
        default:
            return { cmd: "node", args: [filePath] };
    }
}

function truncateOutput(str: string): string {
    if (Buffer.byteLength(str, "utf-8") > MAX_OUTPUT_BYTES) {
        // rough truncation - good enough
        const truncated = str.slice(0, MAX_OUTPUT_BYTES);
        return truncated + "\n\n--- output truncated (exceeded 50KB limit) ---";
    }
    return str;
}

export async function POST(req: NextRequest) {
    try {
        const body: ExecuteRequest = await req.json();
        const { code, language } = body;

        if (!code || !language) {
            return NextResponse.json(
                { output: "", error: "Missing code or language", exitCode: 1, timedOut: false },
                { status: 400 }
            );
        }

        // html and css can't really be "run" on the server
        if (language === "html" || language === "css") {
            return NextResponse.json({
                output: "",
                error: `${language.toUpperCase()} can't be executed directly. Use the browser preview for HTML/CSS.`,
                exitCode: 1,
                timedOut: false,
            });
        }

        // create a temp dir for isolation
        const tempDir = await mkdtemp(join(tmpdir(), "code-exec-"));
        const ext = getFileExtension(language);
        const filePath = join(tempDir, `script${ext}`);

        await writeFile(filePath, code, "utf-8");

        const { cmd, args } = getCommand(language, filePath);

        const result = await new Promise<ExecuteResponse>((resolve) => {
            const proc = execFile(
                cmd,
                args,
                {
                    timeout: TIMEOUT_MS,
                    maxBuffer: MAX_OUTPUT_BYTES * 2,
                    env: { ...process.env, NODE_NO_WARNINGS: "1" },
                    cwd: tempDir,
                },
                (error, stdout, stderr) => {
                    // clean up temp file (fire and forget)
                    unlink(filePath).catch(() => { });

                    const timedOut = error?.killed === true;

                    if (timedOut) {
                        resolve({
                            output: truncateOutput(stdout || ""),
                            error: "Execution timed out (10 second limit exceeded)",
                            exitCode: null,
                            timedOut: true,
                        });
                        return;
                    }

                    resolve({
                        output: truncateOutput(stdout || ""),
                        error: truncateOutput(stderr || ""),
                        exitCode: error ? (error as any).code ?? 1 : 0,
                        timedOut: false,
                    });
                }
            );
        });

        return NextResponse.json(result);
    } catch (err: any) {
        console.error("[api/execute] unexpected error:", err);
        return NextResponse.json(
            { output: "", error: `Server error: ${err.message}`, exitCode: 1, timedOut: false },
            { status: 500 }
        );
    }
}
