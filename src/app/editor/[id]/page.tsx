"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import PresenceBar from "@/components/PresenceBar";
import OutputPanel from "@/components/OutputPanel";
import { useSocket } from "@/hooks/useSocket";
import { useAutosave } from "@/hooks/useAutosave";
import { DocumentOperation } from "@/lib/types";

// dynamic import for codemirror - it doesn't work with SSR
const Editor = dynamic(() => import("@/components/Editor"), { ssr: false });

export default function EditorPage() {
    const params = useParams();
    const router = useRouter();
    const documentId = params.id as string;

    const [docData, setDocData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [content, setContent] = useState("");
    const [title, setTitle] = useState("");
    const [language, setLanguage] = useState("javascript");
    const [version, setVersion] = useState(0);
    const [copied, setCopied] = useState(false);

    // code execution state
    const [isRunning, setIsRunning] = useState(false);
    const [execOutput, setExecOutput] = useState("");
    const [execError, setExecError] = useState("");
    const [execExitCode, setExecExitCode] = useState<number | null>(null);
    const [execTimedOut, setExecTimedOut] = useState(false);
    const [showOutput, setShowOutput] = useState(false);
    const contentRef = useRef(content);

    // keep content ref in sync so runCode always has latest
    useEffect(() => {
        contentRef.current = content;
    }, [content]);

    // grab user from localStorage
    const [user, setUser] = useState<{ id: string; name: string; email: string; avatarColor: string } | null>(null);

    useEffect(() => {
        const cached = localStorage.getItem("collab-editor-user");
        if (cached) {
            setUser(JSON.parse(cached));
        } else {
            // no user, redirect to login
            router.push("/");
        }
    }, [router]);

    // load document data
    useEffect(() => {
        if (!documentId) return;

        async function loadDoc() {
            try {
                const res = await fetch(`/api/documents/${documentId}`);
                if (!res.ok) {
                    setError("Document not found");
                    setLoading(false);
                    return;
                }

                const doc = await res.json();
                setDocData(doc);
                setContent(doc.content);
                setTitle(doc.title);
                setLanguage(doc.language);
                setVersion(doc.version);
                setLoading(false);
            } catch (err) {
                setError("Failed to load document");
                setLoading(false);
            }
        }

        loadDoc();
    }, [documentId]);

    // socket connection
    const socketData = useSocket({
        documentId,
        userId: user?.id || "",
        userName: user?.name || "Anonymous",
        userColor: user?.avatarColor || "#818cf8",
    });

    const { connected, users, saveStatus, sendOperation, sendCursorUpdate, saveDocument } = socketData;

    // refs for remote operation callbacks (used by editor)
    const onOperationRef = (socketData as any).onOperationRef;
    const onAckRef = (socketData as any).onAckRef;

    // autosave
    const { saveNow } = useAutosave({
        content,
        version,
        delay: 2000,
        onSave: useCallback(
            (c: string, v: number) => {
                saveDocument(c, v);
            },
            [saveDocument]
        ),
    });

    // title/language changes -> save immediately
    async function handleTitleChange(newTitle: string) {
        setTitle(newTitle);
        try {
            await fetch(`/api/documents/${documentId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: newTitle }),
            });
        } catch (e) {
            // whatever, we'll catch it next save
        }
    }

    async function handleLanguageChange(newLang: string) {
        setLanguage(newLang);
        try {
            await fetch(`/api/documents/${documentId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ language: newLang }),
            });
        } catch (e) {
            // same
        }
    }

    function handleCopyId() {
        navigator.clipboard.writeText(documentId);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    async function runCode() {
        if (isRunning) return;

        setIsRunning(true);
        setExecOutput("");
        setExecError("");
        setExecExitCode(null);
        setExecTimedOut(false);
        setShowOutput(true);

        try {
            const res = await fetch("/api/execute", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code: contentRef.current, language }),
            });

            const data = await res.json();
            setExecOutput(data.output || "");
            setExecError(data.error || "");
            setExecExitCode(data.exitCode);
            setExecTimedOut(data.timedOut || false);
        } catch (err: any) {
            setExecError(`Failed to execute: ${err.message}`);
            setExecExitCode(1);
        } finally {
            setIsRunning(false);
        }
    }

    function clearOutput() {
        setExecOutput("");
        setExecError("");
        setExecExitCode(null);
        setExecTimedOut(false);
    }

    if (loading || !user) {
        return (
            <div className="loading-screen">
                <div className="loading-spinner" />
                <p>Loading editor...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="error-screen">
                <h2>Oops</h2>
                <p>{error}</p>
                <button className="btn-primary" onClick={() => router.push("/")}>
                    Back to Dashboard
                </button>
            </div>
        );
    }

    return (
        <div className="editor-page">
            <PresenceBar
                users={users}
                currentUserId={user.id}
                documentTitle={title}
                language={language}
                saveStatus={saveStatus}
                connected={connected}
                onTitleChange={handleTitleChange}
                onLanguageChange={handleLanguageChange}
            />

            <div className="editor-toolbar">
                <button className="btn-ghost btn-sm" onClick={() => router.push("/")}>
                    ← Back
                </button>
                <div className="toolbar-center">
                    <span className="toolbar-hint">
                        Share this ID to collaborate:
                        <button className="copy-id-btn" onClick={handleCopyId}>
                            {copied ? "Copied!" : documentId.slice(0, 12) + "…"}
                        </button>
                    </span>
                </div>
                <div className="toolbar-right">
                    <button
                        className={`run-btn ${isRunning ? "run-btn-running" : ""}`}
                        onClick={runCode}
                        disabled={isRunning}
                        title="Run code (executes on server)"
                    >
                        {isRunning ? (
                            <>
                                <span className="run-spinner" />
                                Running…
                            </>
                        ) : (
                            <>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                    <polygon points="5 3 19 12 5 21 5 3" />
                                </svg>
                                Run
                            </>
                        )}
                    </button>
                    <button className="btn-ghost btn-sm" onClick={saveNow}>
                        Save now
                    </button>
                </div>
            </div>

            <div className={`editor-main ${showOutput ? "editor-main-split" : ""}`}>
                <div className="editor-pane">
                    <Editor
                        initialContent={content}
                        language={language}
                        documentId={documentId}
                        userId={user.id}
                        version={version}
                        users={users}
                        onOperation={sendOperation}
                        onCursorUpdate={sendCursorUpdate}
                        onContentChange={(c) => {
                            setContent(c);
                            setVersion((v) => v + 1);
                        }}
                        onRemoteOperation={
                            onOperationRef
                                ? (cb: (op: DocumentOperation) => void) => {
                                    onOperationRef.current = cb;
                                }
                                : undefined
                        }
                        onAck={
                            onAckRef
                                ? (cb: (data: { version: number; opId: string }) => void) => {
                                    onAckRef.current = cb;
                                }
                                : undefined
                        }
                    />
                </div>

                <OutputPanel
                    output={execOutput}
                    error={execError}
                    isRunning={isRunning}
                    timedOut={execTimedOut}
                    exitCode={execExitCode}
                    visible={showOutput}
                    onClear={clearOutput}
                    onClose={() => setShowOutput(false)}
                />
            </div>
        </div>
    );
}
