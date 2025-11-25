import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/documents - list all documents
export async function GET() {
    try {
        const documents = await prisma.document.findMany({
            include: {
                collaborators: {
                    include: {
                        user: {
                            select: { id: true, name: true, email: true, avatarColor: true },
                        },
                    },
                },
            },
            orderBy: { updatedAt: "desc" },
        });

        return NextResponse.json(documents);
    } catch (error) {
        console.error("failed to fetch documents:", error);
        return NextResponse.json(
            { error: "failed to fetch documents" },
            { status: 500 }
        );
    }
}

// POST /api/documents - create new document
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { title, language, userId } = body;

        const document = await prisma.document.create({
            data: {
                title: title || "Untitled",
                language: language || "javascript",
                content: getDefaultContent(language || "javascript"),
                collaborators: userId
                    ? {
                        create: {
                            userId,
                            role: "owner",
                        },
                    }
                    : undefined,
            },
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

        return NextResponse.json(document, { status: 201 });
    } catch (error) {
        console.error("failed to create document:", error);
        return NextResponse.json(
            { error: "failed to create document" },
            { status: 500 }
        );
    }
}

function getDefaultContent(language: string): string {
    switch (language) {
        case "javascript":
            return '// start coding here\nconsole.log("hello world");\n';
        case "typescript":
            return '// start coding here\nconst greeting: string = "hello world";\nconsole.log(greeting);\n';
        case "python":
            return '# start coding here\nprint("hello world")\n';
        case "html":
            return '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <title>Document</title>\n</head>\n<body>\n  <h1>Hello World</h1>\n</body>\n</html>\n';
        case "css":
            return "/* start coding here */\nbody {\n  margin: 0;\n  padding: 0;\n}\n";
        default:
            return "";
    }
}
