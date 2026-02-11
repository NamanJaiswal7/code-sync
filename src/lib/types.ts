// shared types for the collab editor

export interface UserPresence {
    userId: string;
    name: string;
    color: string;
    cursor: CursorPosition | null;
    selection: SelectionRange | null;
    lastActive: number;
}

export interface CursorPosition {
    line: number;
    ch: number;
}

export interface SelectionRange {
    anchor: CursorPosition;
    head: CursorPosition;
}

export type OperationType = "insert" | "delete" | "retain";

export interface TextOperation {
    type: OperationType;
    position: number;
    text?: string;     // for insert
    length?: number;   // for delete/retain
}

export interface DocumentOperation {
    id: string;
    documentId: string;
    userId: string;
    version: number;
    operations: TextOperation[];
    timestamp: number;
}

export interface DocumentState {
    id: string;
    title: string;
    language: string;
    content: string;
    version: number;
}

export interface CollaboratorInfo {
    userId: string;
    name: string;
    email: string;
    color: string;
    role: string;
    isOnline: boolean;
}

// socket events - keeping these typed so we don't mess up event names
export interface ServerToClientEvents {
    "document:state": (state: DocumentState) => void;
    "document:operation": (op: DocumentOperation) => void;
    "document:ack": (data: { version: number; opId: string }) => void;
    "document:error": (error: { message: string; code: string }) => void;
    "presence:update": (users: UserPresence[]) => void;
    "presence:joined": (user: UserPresence) => void;
    "presence:left": (userId: string) => void;
    "cursor:update": (data: { userId: string; cursor: CursorPosition | null; selection: SelectionRange | null }) => void;
    "save:status": (data: { status: "saving" | "saved" | "error"; version: number }) => void;
}

export interface ClientToServerEvents {
    "document:join": (data: { documentId: string; userId: string; name: string; color: string }) => void;
    "document:leave": (data: { documentId: string }) => void;
    "document:operation": (op: DocumentOperation) => void;
    "cursor:update": (data: { documentId: string; cursor: CursorPosition | null; selection: SelectionRange | null }) => void;
    "document:save": (data: { documentId: string; content: string; version: number }) => void;
}

export interface InterServerEvents {
    // empty for now
}

export interface SocketData {
    // empty for now
}

export const SUPPORTED_LANGUAGES = [
    { id: "javascript", label: "JavaScript", ext: ".js" },
    { id: "typescript", label: "TypeScript", ext: ".ts" },
    { id: "python", label: "Python", ext: ".py" },
    { id: "html", label: "HTML", ext: ".html" },
    { id: "css", label: "CSS", ext: ".css" },
] as const;

// random colors for user avatars - tried to pick ones that look good on dark bg
export const USER_COLORS = [
    "#f87171", // red
    "#fb923c", // orange
    "#fbbf24", // amber
    "#34d399", // emerald
    "#22d3ee", // cyan
    "#818cf8", // indigo
    "#c084fc", // purple
    "#f472b6", // pink
    "#a3e635", // lime
    "#2dd4bf", // teal
];
