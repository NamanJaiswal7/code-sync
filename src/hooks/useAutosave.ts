"use client";

import { useRef, useCallback, useEffect } from "react";

interface UseAutosaveOptions {
    content: string;
    version: number;
    delay?: number; // ms
    onSave: (content: string, version: number) => void;
}

export function useAutosave({ content, version, delay = 2000, onSave }: UseAutosaveOptions) {
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const lastSavedRef = useRef<string>(content);
    const contentRef = useRef(content);
    const versionRef = useRef(version);

    // keep refs up to date
    useEffect(() => {
        contentRef.current = content;
    }, [content]);

    useEffect(() => {
        versionRef.current = version;
    }, [version]);

    // debounced save
    const scheduleAutosave = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }

        timerRef.current = setTimeout(() => {
            const current = contentRef.current;
            if (current !== lastSavedRef.current) {
                lastSavedRef.current = current;
                onSave(current, versionRef.current);
            }
        }, delay);
    }, [delay, onSave]);

    // trigger save on content change
    useEffect(() => {
        scheduleAutosave();
    }, [content, scheduleAutosave]);

    // cleanup on unmount - save if there's pending changes
    useEffect(() => {
        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
            // save any unsaved work before leaving
            const current = contentRef.current;
            if (current !== lastSavedRef.current) {
                onSave(current, versionRef.current);
            }
        };
    }, [onSave]);

    // manually trigger save
    const saveNow = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }
        const current = contentRef.current;
        lastSavedRef.current = current;
        onSave(current, versionRef.current);
    }, [onSave]);

    return { saveNow };
}
