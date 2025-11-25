import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface RouteParams {
    params: Promise<{ id: string }>;
}

// GET /api/documents/[id]
export async function GET(request: NextRequest, { params }: RouteParams) {
    const { id } = await params;

    try {
        const document = await prisma.document.findUnique({
            where: { id },
            include: {
                collaborators: {
                    include: {
                        user: {
                            select: { id: true, name: true, email: true, avatarColor: true },
                        },
                    },
                },
            },
        });

        if (!document) {
            return NextResponse.json({ error: "document not found" }, { status: 404 });
        }

        // init the socket server's in-memory state if available
        if (typeof (global as any).__initDocState === "function") {
            (global as any).__initDocState(document.id, document.content, document.version);
        }

        return NextResponse.json(document);
    } catch (error) {
        console.error("failed to fetch document:", error);
        return NextResponse.json(
            { error: "failed to fetch document" },
            { status: 500 }
        );
    }
}

// PUT /api/documents/[id] - update document content
export async function PUT(request: NextRequest, { params }: RouteParams) {
    const { id } = await params;

    try {
        const body = await request.json();
        const { content, title, language, version } = body;

        const updateData: Record<string, any> = {};
        if (content !== undefined) updateData.content = content;
        if (title !== undefined) updateData.title = title;
        if (language !== undefined) updateData.language = language;
        if (version !== undefined) updateData.version = version;

        const document = await prisma.document.update({
            where: { id },
            data: updateData,
        });

        return NextResponse.json(document);
    } catch (error) {
        console.error("failed to update document:", error);
        return NextResponse.json(
            { error: "failed to update document" },
            { status: 500 }
        );
    }
}

// DELETE /api/documents/[id]
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    const { id } = await params;

    try {
        await prisma.document.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("failed to delete document:", error);
        return NextResponse.json(
            { error: "failed to delete document" },
            { status: 500 }
        );
    }
}
