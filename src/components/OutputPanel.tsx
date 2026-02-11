"use client";

import { useEffect, useRef } from "react";

interface OutputPanelProps {
    output: string;
    error: string;
    isRunning: boolean;
    timedOut: boolean;
    exitCode: number | null;
    visible: boolean;
    onClear: () => void;
    onClose: () => void;
}

export default function OutputPanel({
    output,
    error,
    isRunning,
    timedOut,
    exitCode,
    visible,
    onClear,
    onClose,
}: OutputPanelProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    // auto-scroll to bottom when output changes
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [output, error, isRunning]);

    if (!visible) return null;

    const hasOutput = output.length > 0 || error.length > 0;

    function getStatusLabel() {
        if (isRunning) return { text: "Running…", className: "status-running" };
        if (timedOut) return { text: "Timed out", className: "status-error" };
        if (exitCode !== null && exitCode !== 0) return { text: `Exit code ${exitCode}`, className: "status-error" };
        if (exitCode === 0) return { text: "Completed", className: "status-success" };
        return { text: "Ready", className: "status-idle" };
    }

    const status = getStatusLabel();

    return (
        <div className="output-panel">
            <div className="output-header">
                <div className="output-header-left">
                    <span className="output-title">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="4 17 10 11 4 5" />
                            <line x1="12" y1="19" x2="20" y2="19" />
                        </svg>
                        Output
                    </span>
                    <span className={`output-status ${status.className}`}>
                        {isRunning && <span className="output-spinner" />}
                        {status.text}
                    </span>
                </div>
                <div className="output-header-right">
                    <button className="output-action-btn" onClick={onClear} title="Clear output">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6h18" />
                            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                        </svg>
                    </button>
                    <button className="output-action-btn" onClick={onClose} title="Close panel">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>
            </div>

            <div className="output-body" ref={scrollRef}>
                {isRunning && !hasOutput && (
                    <div className="output-placeholder">
                        <span className="output-spinner-lg" />
                        <span>Executing code…</span>
                    </div>
                )}

                {!isRunning && !hasOutput && (
                    <div className="output-placeholder">
                        <span style={{ opacity: 0.5 }}>Click ▶ Run to execute your code</span>
                    </div>
                )}

                {output && (
                    <pre className="output-stdout">{output}</pre>
                )}

                {error && (
                    <pre className="output-stderr">{error}</pre>
                )}
            </div>
        </div>
    );
}
