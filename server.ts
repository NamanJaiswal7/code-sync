import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server as SocketServer } from "socket.io";
import {
    ServerToClientEvents,
    ClientToServerEvents,
    UserPresence,
    DocumentOperation,
} from "./src/lib/types";
import { ServerDocumentState } from "./src/lib/collaboration";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// in-memory doc state - good enough for now, would use redis in prod
const documentStates = new Map<string, ServerDocumentState>();
const roomUsers = new Map<string, Map<string, UserPresence>>();

app.prepare().then(() => {
    const httpServer = createServer((req, res) => {
        const parsedUrl = parse(req.url!, true);
        handle(req, res, parsedUrl);
    });

    const io = new SocketServer<ClientToServerEvents, ServerToClientEvents>(
        httpServer,
        {
            cors: {
                origin: "*", // TODO: lock this down for prod
                methods: ["GET", "POST"],
            },
            // increase max buffer for large docs
            maxHttpBufferSize: 1e7,
        }
    );

    io.on("connection", (socket) => {
        let currentDocId: string | null = null;
        let currentUserId: string | null = null;

        socket.on("document:join", ({ documentId, userId, name, color }) => {
            currentDocId = documentId;
            currentUserId = userId;

            socket.join(`doc:${documentId}`);

            // setup room tracking
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

            roomUsers.get(documentId)!.set(userId, presence);

            // let others know someone joined
            socket.to(`doc:${documentId}`).emit("presence:joined", presence);

            // send current presence list to the joining user
            const users = Array.from(roomUsers.get(documentId)!.values());
            socket.emit("presence:update", users);

            // init doc state if needed
            if (!documentStates.has(documentId)) {
                // we'll load actual content from the db via API before joining
                // for now just create empty state
                documentStates.set(documentId, new ServerDocumentState("", 0));
            }

            const docState = documentStates.get(documentId)!;
            socket.emit("document:state", {
                id: documentId,
                title: "",
                language: "javascript",
                content: docState.content,
                version: docState.version,
            });

            console.log(`[socket] ${name} joined doc ${documentId}`);
        });

        socket.on("document:operation", (op: DocumentOperation) => {
            if (!currentDocId) return;

            const docState = documentStates.get(currentDocId);
            if (!docState) return;

            const result = docState.receiveOperation(op);
            if (!result) {
                socket.emit("document:error", {
                    message: "failed to apply operation",
                    code: "OP_FAILED",
                });
                return;
            }

            // ack the sender
            socket.emit("document:ack", {
                version: result.newVersion,
                opId: op.id,
            });

            // broadcast transformed op to everyone else
            socket.to(`doc:${currentDocId}`).emit("document:operation", result.transformed);

            // update last active
            if (currentUserId && roomUsers.get(currentDocId)?.has(currentUserId)) {
                roomUsers.get(currentDocId)!.get(currentUserId)!.lastActive = Date.now();
            }
        });

        socket.on("cursor:update", ({ documentId, cursor, selection }) => {
            if (!currentUserId) return;

            const room = roomUsers.get(documentId);
            if (room && room.has(currentUserId)) {
                const user = room.get(currentUserId)!;
                user.cursor = cursor;
                user.selection = selection;
                user.lastActive = Date.now();
            }

            socket.to(`doc:${documentId}`).emit("cursor:update", {
                userId: currentUserId,
                cursor,
                selection,
            });
        });

        socket.on("document:save", async ({ documentId, content, version }) => {
            // update in-memory state
            const docState = documentStates.get(documentId);
            if (docState) {
                docState.content = content;
            }

            try {
                // save to db via internal api
                const res = await fetch(`http://${hostname}:${port}/api/documents/${documentId}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ content, version }),
                });

                if (res.ok) {
                    io.to(`doc:${documentId}`).emit("save:status", {
                        status: "saved",
                        version,
                    });
                } else {
                    socket.emit("save:status", { status: "error", version });
                }
            } catch (err) {
                console.error("[socket] save failed:", err);
                socket.emit("save:status", { status: "error", version });
            }
        });

        socket.on("document:leave", ({ documentId }) => {
            handleLeave(socket, documentId, currentUserId);
            currentDocId = null;
            currentUserId = null;
        });

        socket.on("disconnect", () => {
            if (currentDocId && currentUserId) {
                handleLeave(socket, currentDocId, currentUserId);
            }
        });
    });

    function handleLeave(socket: any, documentId: string, userId: string | null) {
        socket.leave(`doc:${documentId}`);

        if (userId) {
            const room = roomUsers.get(documentId);
            if (room) {
                room.delete(userId);
                if (room.size === 0) {
                    roomUsers.delete(documentId);
                    // could also clean up doc state here but lets keep it cached
                }
            }

            socket.to(`doc:${documentId}`).emit("presence:left", userId);
            console.log(`[socket] user ${userId} left doc ${documentId}`);
        }
    }

    // init document state when we know the content (called from API)
    (global as any).__initDocState = (
        documentId: string,
        content: string,
        version: number
    ) => {
        if (!documentStates.has(documentId)) {
            documentStates.set(documentId, new ServerDocumentState(content, version));
        } else {
            const state = documentStates.get(documentId)!;
            if (state.version === 0 && version > 0) {
                state.content = content;
                state.version = version;
            }
        }
    };

    httpServer.listen(port, () => {
        console.log(`> Ready on http://${hostname}:${port}`);
    });
});
