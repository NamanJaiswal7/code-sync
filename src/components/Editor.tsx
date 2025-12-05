"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { EditorView, keymap, ViewUpdate } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { basicSetup } from "codemirror";
import { oneDark } from "@codemirror/theme-one-dark";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { indentWithTab } from "@codemirror/commands";
import {
    TextOperation,
    DocumentOperation,
    CursorPosition,
    SelectionRange,
    UserPresence,
} from "@/lib/types";
import { v4 as uuidv4 } from "uuid";

interface EditorProps {
    initialContent: string;
    language: string;
    documentId: string;
    userId: string;
    version: number;
    users: UserPresence[];
    onOperation: (op: DocumentOperation) => void;
    onCursorUpdate: (cursor: CursorPosition | null, selection: SelectionRange | null) => void;
    onContentChange: (content: string) => void;
    onRemoteOperation?: (callback: (op: DocumentOperation) => void) => void;
    onAck?: (callback: (data: { version: number; opId: string }) => void) => void;
}

function getLanguageExtension(lang: string) {
    switch (lang) {
        case "javascript":
            return javascript();
        case "typescript":
            return javascript({ typescript: true });
        case "python":
            return python();
        case "html":
            return html();
        case "css":
            return css();
        default:
            return javascript();
    }
}

export default function Editor({
    initialContent,
    language,
    documentId,
    userId,
    version,
    users,
    onOperation,
    onCursorUpdate,
    onContentChange,
    onRemoteOperation,
    onAck,
}: EditorProps) {
    const editorRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const versionRef = useRef(version);
    const isRemoteUpdate = useRef(false);

    // track version
    useEffect(() => {
        versionRef.current = version;
    }, [version]);

    useEffect(() => {
        if (!editorRef.current) return;

        const langExtension = getLanguageExtension(language);

        const updateListener = EditorView.updateListener.of((update: ViewUpdate) => {
            if (isRemoteUpdate.current) return;

            if (update.docChanged) {
                const ops: TextOperation[] = [];

                update.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
                    // delete
                    if (toA > fromA) {
                        ops.push({
                            type: "delete",
                            position: fromA,
                            length: toA - fromA,
                        });
                    }
                    // insert
                    const insertedText = inserted.toString();
                    if (insertedText.length > 0) {
                        ops.push({
                            type: "insert",
                            position: fromA,
                            text: insertedText,
                        });
                    }
                });

                if (ops.length > 0) {
                    const docOp: DocumentOperation = {
                        id: uuidv4(),
                        documentId,
                        userId,
                        version: versionRef.current,
                        operations: ops,
                        timestamp: Date.now(),
                    };
                    onOperation(docOp);
                }

                onContentChange(update.state.doc.toString());
            }

            // cursor/selection changes
            if (update.selectionSet) {
                const sel = update.state.selection.main;
                const doc = update.state.doc;

                const headLine = doc.lineAt(sel.head);
                const cursor: CursorPosition = {
                    line: headLine.number - 1,
                    ch: sel.head - headLine.from,
                };

                let selection: SelectionRange | null = null;
                if (!sel.empty) {
                    const anchorLine = doc.lineAt(sel.anchor);
                    selection = {
                        anchor: { line: anchorLine.number - 1, ch: sel.anchor - anchorLine.from },
                        head: cursor,
                    };
                }

                onCursorUpdate(cursor, selection);
            }
        });

        const state = EditorState.create({
            doc: initialContent,
            extensions: [
                basicSetup,
                langExtension,
                oneDark,
                keymap.of([indentWithTab]),
                updateListener,
                EditorView.theme({
                    "&": {
                        height: "100%",
                        fontSize: "14px",
                    },
                    ".cm-scroller": {
                        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                        overflow: "auto",
                    },
                    ".cm-content": {
                        padding: "12px 0",
                    },
                    ".cm-gutters": {
                        backgroundColor: "transparent",
                        borderRight: "1px solid rgba(255,255,255,0.06)",
                    },
                    ".cm-activeLineGutter": {
                        backgroundColor: "rgba(255,255,255,0.05)",
                    },
                    ".cm-activeLine": {
                        backgroundColor: "rgba(255,255,255,0.03)",
                    },
                }),
            ],
        });

        const view = new EditorView({
            state,
            parent: editorRef.current,
        });

        viewRef.current = view;

        return () => {
            view.destroy();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [language]);

    // handle incoming remote operations
    useEffect(() => {
        if (!onRemoteOperation) return;

        onRemoteOperation((op: DocumentOperation) => {
            const view = viewRef.current;
            if (!view) return;

            isRemoteUpdate.current = true;

            try {
                const changes: { from: number; to?: number; insert?: string }[] = [];

                let offset = 0;
                for (const textOp of op.operations) {
                    if (textOp.type === "insert" && textOp.text) {
                        changes.push({
                            from: textOp.position + offset,
                            insert: textOp.text,
                        });
                        offset += textOp.text.length;
                    } else if (textOp.type === "delete" && textOp.length) {
                        const from = textOp.position + offset;
                        const to = Math.min(from + textOp.length, view.state.doc.length);
                        changes.push({ from, to });
                        offset -= textOp.length;
                    }
                }

                if (changes.length > 0) {
                    view.dispatch({
                        changes,
                        // don't move cursor - important for remote ops
                    });
                }

                versionRef.current = op.version;
                onContentChange(view.state.doc.toString());
            } finally {
                isRemoteUpdate.current = false;
            }
        });
    }, [onRemoteOperation, onContentChange]);

    // handle acks
    useEffect(() => {
        if (!onAck) return;

        onAck(({ version: newVersion }) => {
            versionRef.current = newVersion;
        });
    }, [onAck]);

    // render remote cursors using DOM overlays
    const cursorLayerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const view = viewRef.current;
        const layer = cursorLayerRef.current;
        if (!view || !layer) return;

        // clear existing cursors
        layer.innerHTML = "";

        const remoteUsers = users.filter((u) => u.userId !== userId && u.cursor);

        for (const user of remoteUsers) {
            if (!user.cursor) continue;

            try {
                const doc = view.state.doc;
                const lineNum = Math.min(user.cursor.line + 1, doc.lines);
                const line = doc.line(lineNum);
                const pos = Math.min(line.from + user.cursor.ch, line.to);
                const coords = view.coordsAtPos(pos);

                if (!coords) continue;

                const editorRect = editorRef.current?.getBoundingClientRect();
                if (!editorRect) continue;

                // cursor line
                const cursorEl = document.createElement("div");
                cursorEl.className = "remote-cursor";
                cursorEl.style.cssText = `
          position: absolute;
          left: ${coords.left - editorRect.left}px;
          top: ${coords.top - editorRect.top}px;
          width: 2px;
          height: ${coords.bottom - coords.top}px;
          background: ${user.color};
          pointer-events: none;
          z-index: 10;
          transition: left 0.1s ease, top 0.1s ease;
        `;

                // name label
                const labelEl = document.createElement("div");
                labelEl.className = "remote-cursor-label";
                labelEl.textContent = user.name;
                labelEl.style.cssText = `
          position: absolute;
          left: ${coords.left - editorRect.left}px;
          top: ${coords.top - editorRect.top - 18}px;
          background: ${user.color};
          color: white;
          font-size: 11px;
          padding: 1px 6px;
          border-radius: 3px 3px 3px 0;
          white-space: nowrap;
          pointer-events: none;
          z-index: 11;
          font-family: 'Inter', sans-serif;
          font-weight: 500;
        `;

                layer.appendChild(cursorEl);
                layer.appendChild(labelEl);

                // selection highlight
                if (user.selection) {
                    const anchorLine = doc.line(
                        Math.min(user.selection.anchor.line + 1, doc.lines)
                    );
                    const anchorPos = Math.min(
                        anchorLine.from + user.selection.anchor.ch,
                        anchorLine.to
                    );
                    const startPos = Math.min(anchorPos, pos);
                    const endPos = Math.max(anchorPos, pos);

                    // highlight each line of the selection
                    for (let p = startPos; p < endPos;) {
                        const lineAtP = doc.lineAt(p);
                        const lineEnd = Math.min(lineAtP.to, endPos);
                        const startCoords = view.coordsAtPos(p);
                        const endCoords = view.coordsAtPos(lineEnd);

                        if (startCoords && endCoords) {
                            const selEl = document.createElement("div");
                            selEl.className = "remote-selection";
                            selEl.style.cssText = `
                position: absolute;
                left: ${startCoords.left - editorRect.left}px;
                top: ${startCoords.top - editorRect.top}px;
                width: ${endCoords.left - startCoords.left}px;
                height: ${startCoords.bottom - startCoords.top}px;
                background: ${user.color}22;
                pointer-events: none;
                z-index: 5;
              `;
                            layer.appendChild(selEl);
                        }

                        p = lineEnd + 1; // move to next line
                    }
                }
            } catch (e) {
                // coords can fail if doc changed, just skip
            }
        }
    }, [users, userId]);

    return (
        <div className="editor-wrapper" style={{ position: "relative", height: "100%" }}>
            <div ref={editorRef} className="editor-container" style={{ height: "100%" }} />
            <div ref={cursorLayerRef} className="cursor-layer" style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }} />
        </div>
    );
}
