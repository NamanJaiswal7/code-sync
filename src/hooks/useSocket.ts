"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import {
    ServerToClientEvents,
    ClientToServerEvents,
    DocumentState,
    UserPresence,
    DocumentOperation,
    CursorPosition,
    SelectionRange,
} from "@/lib/types";

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface UseSocketOptions {
    documentId: string;
    userId: string;
    userName: string;
    userColor: string;
}

interface UseSocketReturn {
    socket: AppSocket | null;
    connected: boolean;
    documentState: DocumentState | null;
    users: UserPresence[];
    saveStatus: "idle" | "saving" | "saved" | "error";
    sendOperation: (op: DocumentOperation) => void;
    sendCursorUpdate: (cursor: CursorPosition | null, selection: SelectionRange | null) => void;
    saveDocument: (content: string, version: number) => void;
}

export function useSocket({
    documentId,
    userId,
    userName,
    userColor,
}: UseSocketOptions): UseSocketReturn {
    const socketRef = useRef<AppSocket | null>(null);
    const [connected, setConnected] = useState(false);
    const [documentState, setDocumentState] = useState<DocumentState | null>(null);
    const [users, setUsers] = useState<UserPresence[]>([]);
    const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

    // queue for ops sent while disconnected
    const pendingOps = useRef<DocumentOperation[]>([]);
    const onOperationRef = useRef<((op: DocumentOperation) => void) | null>(null);
    const onAckRef = useRef<((data: { version: number; opId: string }) => void) | null>(null);

    useEffect(() => {
        const socket: AppSocket = io({
            transports: ["websocket", "polling"],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
        });

        socketRef.current = socket;

        socket.on("connect", () => {
            setConnected(true);

            // join the doc room
            socket.emit("document:join", {
                documentId,
                userId,
                name: userName,
                color: userColor,
            });

            // flush any pending ops
            if (pendingOps.current.length > 0) {
                for (const op of pendingOps.current) {
                    socket.emit("document:operation", op);
                }
                pendingOps.current = [];
            }
        });

        socket.on("disconnect", () => {
            setConnected(false);
        });

        socket.on("document:state", (state) => {
            setDocumentState(state);
        });

        socket.on("document:operation", (op) => {
            if (onOperationRef.current) {
                onOperationRef.current(op);
            }
        });

        socket.on("document:ack", (data) => {
            if (onAckRef.current) {
                onAckRef.current(data);
            }
        });

        socket.on("document:error", (error) => {
            console.error("[socket] error:", error);
        });

        socket.on("presence:update", (userList) => {
            setUsers(userList);
        });

        socket.on("presence:joined", (user) => {
            setUsers((prev) => {
                const filtered = prev.filter((u) => u.userId !== user.userId);
                return [...filtered, user];
            });
        });

        socket.on("presence:left", (leftUserId) => {
            setUsers((prev) => prev.filter((u) => u.userId !== leftUserId));
        });

        socket.on("cursor:update", ({ userId: uid, cursor, selection }) => {
            setUsers((prev) =>
                prev.map((u) =>
                    u.userId === uid ? { ...u, cursor, selection, lastActive: Date.now() } : u
                )
            );
        });

        socket.on("save:status", ({ status, version }) => {
            setSaveStatus(status);
            if (status === "saved") {
                // reset after a couple seconds
                setTimeout(() => setSaveStatus("idle"), 2000);
            }
        });

        return () => {
            socket.emit("document:leave", { documentId });
            socket.disconnect();
        };
    }, [documentId, userId, userName, userColor]);

    const sendOperation = useCallback((op: DocumentOperation) => {
        if (socketRef.current?.connected) {
            socketRef.current.emit("document:operation", op);
        } else {
            pendingOps.current.push(op);
        }
    }, []);

    const sendCursorUpdate = useCallback(
        (cursor: CursorPosition | null, selection: SelectionRange | null) => {
            if (socketRef.current?.connected) {
                socketRef.current.emit("cursor:update", {
                    documentId,
                    cursor,
                    selection,
                });
            }
        },
        [documentId]
    );

    const saveDocument = useCallback(
        (content: string, version: number) => {
            setSaveStatus("saving");
            if (socketRef.current?.connected) {
                socketRef.current.emit("document:save", {
                    documentId,
                    content,
                    version,
                });
            } else {
                setSaveStatus("error");
            }
        },
        [documentId]
    );

    // expose refs so the editor can set callbacks
    const result: UseSocketReturn & {
        onOperationRef: typeof onOperationRef;
        onAckRef: typeof onAckRef;
    } = {
        socket: socketRef.current,
        connected,
        documentState,
        users,
        saveStatus,
        sendOperation,
        sendCursorUpdate,
        saveDocument,
        onOperationRef,
        onAckRef,
    };

    return result;
}
