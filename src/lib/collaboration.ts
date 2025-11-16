import { TextOperation, DocumentOperation } from "./types";

/**
 * basic OT engine for collaborative text editing
 * 
 * this handles transforming operations when two users edit the same doc
 * concurrently. it's not perfect (no undo support yet) but handles the
 * common cases well enough
 */

// apply a single op to a string and return the result
export function applyOperation(content: string, op: TextOperation): string {
    switch (op.type) {
        case "insert":
            if (op.position < 0 || op.position > content.length) {
                // clamp to valid range instead of crashing
                const pos = Math.max(0, Math.min(op.position, content.length));
                return content.slice(0, pos) + (op.text || "") + content.slice(pos);
            }
            return content.slice(0, op.position) + (op.text || "") + content.slice(op.position);

        case "delete":
            const deleteEnd = Math.min(op.position + (op.length || 0), content.length);
            return content.slice(0, op.position) + content.slice(deleteEnd);

        case "retain":
            // retain doesn't change the document
            return content;

        default:
            return content;
    }
}

// apply all ops from a DocumentOperation to a document
export function applyOperations(content: string, docOp: DocumentOperation): string {
    let result = content;
    for (const op of docOp.operations) {
        result = applyOperation(result, op);
    }
    return result;
}

/**
 * Transform operation A against operation B
 * Both ops were applied to the same document state, but we need to
 * adjust A so it can be applied after B
 */
export function transformOperation(
    opA: TextOperation,
    opB: TextOperation
): TextOperation {
    // both inserts
    if (opA.type === "insert" && opB.type === "insert") {
        if (opA.position <= opB.position) {
            return opA; // A goes first, no change needed
        } else {
            return {
                ...opA,
                position: opA.position + (opB.text?.length || 0),
            };
        }
    }

    // A is insert, B is delete
    if (opA.type === "insert" && opB.type === "delete") {
        if (opA.position <= opB.position) {
            return opA;
        } else if (opA.position >= opB.position + (opB.length || 0)) {
            return {
                ...opA,
                position: opA.position - (opB.length || 0),
            };
        } else {
            // insert falls inside deleted range, move to deletion start
            return {
                ...opA,
                position: opB.position,
            };
        }
    }

    // A is delete, B is insert
    if (opA.type === "delete" && opB.type === "insert") {
        if (opA.position >= opB.position) {
            return {
                ...opA,
                position: opA.position + (opB.text?.length || 0),
            };
        } else if (opA.position + (opA.length || 0) <= opB.position) {
            return opA;
        } else {
            // deletion range spans the insertion point
            return {
                ...opA,
                length: (opA.length || 0) + (opB.text?.length || 0),
            };
        }
    }

    // both deletes
    if (opA.type === "delete" && opB.type === "delete") {
        const aEnd = opA.position + (opA.length || 0);
        const bEnd = opB.position + (opB.length || 0);

        if (aEnd <= opB.position) {
            return opA; // A is entirely before B
        } else if (opA.position >= bEnd) {
            return {
                ...opA,
                position: opA.position - (opB.length || 0),
            };
        } else {
            // overlapping deletes, need to figure out what's left to delete
            const overlapStart = Math.max(opA.position, opB.position);
            const overlapEnd = Math.min(aEnd, bEnd);
            const overlapLen = overlapEnd - overlapStart;

            const newPos = Math.min(opA.position, opB.position);
            const newLen = (opA.length || 0) - overlapLen;

            if (newLen <= 0) {
                return { type: "retain", position: 0, length: 0 };
            }

            return {
                ...opA,
                position: newPos,
                length: newLen,
            };
        }
    }

    return opA;
}

// transform an entire DocumentOperation against another
export function transformDocumentOperation(
    opsA: TextOperation[],
    opsB: TextOperation[]
): TextOperation[] {
    let transformed = [...opsA];

    for (const opB of opsB) {
        transformed = transformed.map((opA) => transformOperation(opA, opB));
    }

    return transformed;
}

/**
 * manages document state on the server side
 * keeps track of version and handles incoming operations
 */
export class ServerDocumentState {
    content: string;
    version: number;
    private pendingOps: Map<string, DocumentOperation> = new Map();
    private history: DocumentOperation[] = [];

    constructor(content: string, version: number) {
        this.content = content;
        this.version = version;
    }

    receiveOperation(docOp: DocumentOperation): {
        transformed: DocumentOperation;
        newContent: string;
        newVersion: number;
    } | null {
        // if op is based on old version, transform against everything that happened since
        if (docOp.version < this.version) {
            const missedOps = this.history.filter(
                (h) => h.version >= docOp.version && h.userId !== docOp.userId
            );

            let transformedOps = docOp.operations;
            for (const missed of missedOps) {
                transformedOps = transformDocumentOperation(transformedOps, missed.operations);
            }

            docOp = { ...docOp, operations: transformedOps };
        } else if (docOp.version > this.version) {
            // client is ahead of us?? shouldn't happen but lets not crash
            console.warn(`client version ${docOp.version} ahead of server ${this.version}`);
            return null;
        }

        // apply the (possibly transformed) operation
        const newContent = applyOperations(this.content, docOp);
        const newVersion = this.version + 1;

        const transformed: DocumentOperation = {
            ...docOp,
            version: newVersion,
        };

        this.content = newContent;
        this.version = newVersion;
        this.history.push(transformed);

        // keep last 100 ops for transformation, don't want memory to blow up
        if (this.history.length > 100) {
            this.history = this.history.slice(-100);
        }

        return { transformed, newContent, newVersion };
    }
}
