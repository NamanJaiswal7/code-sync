"use client";

import { UserPresence } from "@/lib/types";

interface PresenceBarProps {
    users: UserPresence[];
    currentUserId: string;
    documentTitle: string;
    language: string;
    saveStatus: "idle" | "saving" | "saved" | "error";
    connected: boolean;
    onTitleChange?: (title: string) => void;
    onLanguageChange?: (lang: string) => void;
}

const LANGUAGES = [
    { id: "javascript", label: "JavaScript" },
    { id: "typescript", label: "TypeScript" },
    { id: "python", label: "Python" },
    { id: "html", label: "HTML" },
    { id: "css", label: "CSS" },
];

export default function PresenceBar({
    users,
    currentUserId,
    documentTitle,
    language,
    saveStatus,
    connected,
    onTitleChange,
    onLanguageChange,
}: PresenceBarProps) {
    const otherUsers = users.filter((u) => u.userId !== currentUserId);

    function getSaveStatusText() {
        switch (saveStatus) {
            case "saving":
                return "Saving...";
            case "saved":
                return "Saved";
            case "error":
                return "Save failed";
            default:
                return "";
        }
    }

    function getSaveStatusColor() {
        switch (saveStatus) {
            case "saving":
                return "#fbbf24";
            case "saved":
                return "#34d399";
            case "error":
                return "#f87171";
            default:
                return "transparent";
        }
    }

    return (
        <div className="presence-bar">
            <div className="presence-bar-left">
                <div className="connection-status">
                    <span
                        className="status-dot"
                        style={{ background: connected ? "#34d399" : "#f87171" }}
                    />
                    <span className="status-text">{connected ? "Connected" : "Disconnected"}</span>
                </div>

                <input
                    className="doc-title-input"
                    value={documentTitle}
                    onChange={(e) => onTitleChange?.(e.target.value)}
                    placeholder="Untitled document"
                    spellCheck={false}
                />

                <select
                    className="lang-select"
                    value={language}
                    onChange={(e) => onLanguageChange?.(e.target.value)}
                >
                    {LANGUAGES.map((l) => (
                        <option key={l.id} value={l.id}>
                            {l.label}
                        </option>
                    ))}
                </select>
            </div>

            <div className="presence-bar-right">
                {saveStatus !== "idle" && (
                    <span className="save-status" style={{ color: getSaveStatusColor() }}>
                        {getSaveStatusText()}
                    </span>
                )}

                <div className="user-avatars">
                    {otherUsers.map((user) => (
                        <div
                            key={user.userId}
                            className="user-avatar"
                            title={user.name}
                            style={{
                                background: user.color,
                                borderColor: user.cursor ? user.color : "transparent",
                            }}
                        >
                            {user.name.charAt(0).toUpperCase()}
                        </div>
                    ))}

                    {/* current user */}
                    {users
                        .filter((u) => u.userId === currentUserId)
                        .map((u) => (
                            <div
                                key={u.userId}
                                className="user-avatar current-user"
                                title={`${u.name} (you)`}
                                style={{ background: u.color }}
                            >
                                {u.name.charAt(0).toUpperCase()}
                            </div>
                        ))}
                </div>

                {otherUsers.length > 0 && (
                    <span className="collab-count">
                        {otherUsers.length} collaborator{otherUsers.length !== 1 ? "s" : ""}
                    </span>
                )}
            </div>
        </div>
    );
}
