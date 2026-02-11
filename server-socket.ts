import { createServer } from "http";
import { parse } from "url";
import { Server as SocketServer } from "socket.io";
import { prisma } from "./src/lib/prisma";
import {
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData,
    DocumentState,
    UserPresence,
    DocumentOperation,
    CursorPosition,
    SelectionRange,
} from "./src/lib/types";
import {
    applyOperations,
    createDocumentState,
} from "./src/lib/collaboration";

const port = parseInt(process.env.PORT || "3001", 10);
const dev = process.env.NODE_ENV !== "production";

// parse allowed origins from env, fall back to localhost in dev
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map((s) => s.trim())
    : ["http://localhost:3000"];

console.log(`Starting standalone socket server on port ${port}...`);
console.log(`Allowed origins: ${allowedOrigins.join(", ")}`);

// in-memory doc state - good enough for now, would use redis in prod
interface ServerDocumentState extends DocumentState {
    sockets: Set<string>; // socket ids
    lastSave: number;
}
const documentStates = new Map<string, ServerDocumentState>();

// track users in each room: roomId -> socketId -> UserPresence
const roomUsers = new Map<string, Map<string, UserPresence>>();

function log(message: string, ...args: any[]) {
    const ts = new Date().toISOString();
    console.log(`[${ts}] ${message}`, ...args);
}

// --- Code Execution Logic ---
import { execFile } from "child_process";
import { writeFile, unlink, mkdtemp } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

const TIMEOUT_MS = 10_000;
const MAX_OUTPUT_BYTES = 50 * 1024;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;

const requestLog = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
    const now = Date.now();
    const timestamps = requestLog.get(ip) || [];
    const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
    requestLog.set(ip, recent);
    if (recent.length >= RATE_LIMIT_MAX) return true;
    recent.push(now);
    return false;
}

// rate limit cleanup
setInterval(() => {
    const now = Date.now();
    for (const [ip, timestamps] of requestLog.entries()) {
        const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
        if (recent.length === 0) requestLog.delete(ip);
        else requestLog.set(ip, recent);
    }
}, 5 * 60_000);

function getCommand(language: string, filePath: string): { cmd: string; args: string[] } {
    switch (language) {
        case "javascript": return { cmd: "node", args: ["--no-warnings", filePath] };
        case "typescript": return { cmd: "npx", args: ["tsx", filePath] };
        case "python": return { cmd: "python3", args: ["-u", filePath] };
        default: return { cmd: "node", args: ["--no-warnings", filePath] };
    }
}

function getFileExtension(language: string): string {
    switch (language) {
        case "javascript": return ".js";
        case "typescript": return ".ts";
        case "python": return ".py";
        default: return ".js";
    }
}

function truncateOutput(str: string): string {
    if (Buffer.byteLength(str, "utf-8") > MAX_OUTPUT_BYTES) {
        return str.slice(0, MAX_OUTPUT_BYTES) + "\n\n--- output truncated ---";
    }
    return str;
}

const httpServer = createServer(async (req, res) => {
    // CORS
    res.setHeader("Access-Control-Allow-Origin", dev ? "*" : allowedOrigins[0] || "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        res.writeHead(200);
        res.end();
        return;
    }

    if (req.url === "/health" || req.url === "/") {
        res.writeHead(200);
        res.end("Socket server is running");
        return;
    }

    if (req.url === "/execute" && req.method === "POST") {
        let body = "";
        req.on("data", chunk => body += chunk);
        req.on("end", async () => {
            try {
                const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";

                if (process.env.DISABLE_CODE_EXEC === "true") {
                    res.writeHead(403, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ error: "Execution disabled" }));
                    return;
                }

                if (isRateLimited(ip)) {
                    res.writeHead(429, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ error: "Rate limit exceeded" }));
                    return;
                }

                const { code, language } = JSON.parse(body);
                if (!code || !language) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ error: "Missing code or language" }));
                    return;
                }

                const tempDir = await mkdtemp(join(tmpdir(), "code-exec-"));
                const ext = getFileExtension(language);
                const filePath = join(tempDir, `script${ext}`);
                await writeFile(filePath, code, "utf-8");

                const { cmd, args } = getCommand(language, filePath);

                const result = await new Promise((resolve) => {
                    execFile(cmd, args, {
                        timeout: TIMEOUT_MS,
                        maxBuffer: MAX_OUTPUT_BYTES * 2,
                        cwd: tempDir,
                        env: { ...process.env, NODE_NO_WARNINGS: "1" }
                    }, (error, stdout, stderr) => {
                        unlink(filePath).catch(() => { });
                        if (error?.killed) {
                            resolve({ output: truncateOutput(stdout || ""), error: "Timed out", exitCode: null, timedOut: true });
                        } else {
                            resolve({
                                output: truncateOutput(stdout || ""),
                                error: truncateOutput(stderr || ""),
                                exitCode: error ? (error as any).code ?? 1 : 0,
                                timedOut: false
                            });
                        }
                    });
                });

                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify(result));
            } catch (e: any) {
                console.error("Exec error", e);
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }

    res.writeHead(404);
    res.end();
});

const io = new SocketServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(
    httpServer,
    {
        cors: {
            origin: dev ? "*" : allowedOrigins,
            methods: ["GET", "POST"],
            credentials: true
        },
        // increase max buffer for large docs
        maxHttpBufferSize: 1e7,
    }
);

io.on("connection", (socket) => {
    log(`Client connected: ${socket.id}`);

    socket.on("document:join", async ({ documentId, userId, name, color }) => {
        socket.join(documentId);
        log(`User ${name} (${userId}) joined doc ${documentId}`);

        // init doc state if needed
        if (!documentStates.has(documentId)) {
            // try to load from db
            const doc = await prisma.document.findUnique({ where: { id: documentId } });
            if (doc) {
                documentStates.set(documentId, {
                    id: doc.id,
                    title: doc.title,
                    language: doc.language,
                    version: doc.version,
                    content: doc.content,
                    sockets: new Set(),
                    lastSave: Date.now(),
                });
            } else {
                // new doc or not found
                documentStates.set(documentId, {
                    ...createDocumentState("", 0),
                    id: documentId,
                    title: "Untitled",
                    language: "javascript",
                    sockets: new Set(),
                    lastSave: Date.now(),
                });
            }
        }

        const state = documentStates.get(documentId)!;
        state.sockets.add(socket.id);

        // send current state
        socket.emit("document:state", {
            id: documentId,
            title: "Untitled", // TODO: fetch from db
            language: "javascript",
            version: state.version,
            content: state.content,
        });

        // add user to presence list
        if (!roomUsers.has(documentId)) {
            roomUsers.set(documentId, new Map());
        }
        const presence: UserPresence = {
            userId,
            name,
            color,
            cursor: null,
            selection: null,
            lastActive: Date.now(),
        };
        roomUsers.get(documentId)!.set(socket.id, presence);

        // broadcast presence
        io.to(documentId).emit("presence:joined", presence);
        io.to(documentId).emit(
            "presence:update",
            Array.from(roomUsers.get(documentId)!.values())
        );
    });

    socket.on("document:leave", ({ documentId }) => {
        handleLeave(socket.id, documentId);
    });

    socket.on("disconnecting", () => {
        for (const roomId of socket.rooms) {
            if (roomId !== socket.id) {
                handleLeave(socket.id, roomId);
            }
        }
    });

    socket.on("disconnect", () => {
        log(`Client disconnected: ${socket.id}`);
    });

    socket.on("document:operation", async (op) => {
        const { documentId, version, operations } = op;
        const state = documentStates.get(documentId);

        if (!state) return;

        // Apply OT (simplified - assumes mostly sequential for this MVP)
        // In a real OT system, we'd transform against concurrent ops
        // Here we just broadcast if versions match, or simplistic transform if slightly off
        // Ideally use a library like ot-json0 or yjs for robust OT

        try {
            // apply locally
            state.content = applyOperations(state.content, {
                ...op,
                operations: operations
            });
            state.version += 1;

            // broadcast with new version
            const newOp: DocumentOperation = {
                id: op.id || "server-generated-id", // should ideally come from client
                documentId,
                version: state.version,
                operations,
                userId: op.userId, // pass through the original author
                timestamp: Date.now(),
            };

            // broadcast to everyone including sender (to confirm version bump)
            // or exclude sender if we want optimistic updates + ack
            socket.broadcast.to(documentId).emit("document:operation", newOp);

            // ack to sender
            socket.emit("document:ack", { version: state.version, opId: "optimistic-ack" });

            // debounced save to db
            if (Date.now() - state.lastSave > 2000) {
                saveToDb(documentId, state);
            }
        } catch (e) {
            log(`Error applying op: ${e}`);
            socket.emit("document:error", { message: "Failed to apply operation", code: "APPLY_FAILED" });
        }
    });

    socket.on("cursor:update", ({ documentId, cursor, selection }) => {
        const room = roomUsers.get(documentId);
        if (room && room.has(socket.id)) {
            const user = room.get(socket.id)!;
            user.cursor = cursor;
            user.selection = selection;
            user.lastActive = Date.now();

            // broadcast check - don't flood
            socket.broadcast.to(documentId).emit("cursor:update", {
                userId: user.userId,
                cursor,
                selection
            });
        }
    });

    socket.on("document:save", async ({ documentId, content, version }) => {
        // manual save trigger
        try {
            await prisma.document.update({
                where: { id: documentId },
                data: { content, version, updatedAt: new Date() },
            });
            socket.emit("save:status", { status: "saved", version });

            // update memory state just in case
            if (documentStates.has(documentId)) {
                const state = documentStates.get(documentId)!;
                state.content = content;
                state.version = version;
                state.lastSave = Date.now();
            }
        } catch (e) {
            console.error("Save failed", e);
            socket.emit("save:status", { status: "error", version });
        }
    });
});

function handleLeave(socketId: string, documentId: string) {
    const room = roomUsers.get(documentId);
    if (room && room.has(socketId)) {
        const user = room.get(socketId)!;
        room.delete(socketId);

        // broadcast leave
        io.to(documentId).emit("presence:left", user.userId);
        io.to(documentId).emit(
            "presence:update",
            Array.from(room.values())
        );

        // cleanup empty room state
        if (room.size === 0) {
            roomUsers.delete(documentId);
            // optional: persist and clear doc state from memory after timeout
            const state = documentStates.get(documentId);
            if (state) {
                saveToDb(documentId, state).then(() => {
                    documentStates.delete(documentId);
                    log(`Cleaned up empty doc ${documentId}`);
                });
            }
        }
    }
}

async function saveToDb(documentId: string, state: ServerDocumentState) {
    try {
        await prisma.document.update({
            where: { id: documentId },
            data: {
                content: state.content,
                version: state.version,
                updatedAt: new Date()
            },
        });
        state.lastSave = Date.now();
        log(`Saved doc ${documentId} (v${state.version})`);
    } catch (e) {
        console.error(`Failed to save doc ${documentId}`, e);
    }
}

httpServer.listen(port, () => {
    log(`> Standalone Socket Server ready on http://localhost:${port}`);
});
