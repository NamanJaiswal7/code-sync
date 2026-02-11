# CodeSync - Collaborative Code Editor

Real-time collaborative code editor with live cursor tracking and sync. Built over a couple of months as a side project to learn more about operational transform and websockets.

## What it does

- **Real-time collaboration** - Multiple users can edit the same document simultaneously
- **Live cursor tracking** - See where other users are typing with colored cursors and name labels
- **Conflict resolution** - OT-based conflict resolution handles concurrent edits
- **Autosave** - Changes are automatically saved with debouncing (2s delay)
- **Code Execution** - Run JavaScript, TypeScript, and Python code directly in the browser (sandboxed)
- **Multi-language support** - JavaScript, TypeScript, Python, HTML, CSS syntax highlighting
- **Session management** - Simple auth with persistent sessions via localStorage

## Tech Stack

- **Frontend**: Next.js 14, TypeScript, React
- **Editor**: CodeMirror 6 with One Dark theme
- **Real-time**: Socket.io (WebSocket with polling fallback)
- **Database**: PostgreSQL with Prisma ORM
- **Styling**: Vanilla CSS with custom dark theme

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL running locally (or a remote instance)

### Setup

```bash
# install dependencies
npm install

# set up your database url in .env
# DATABASE_URL="postgresql://postgres:postgres@localhost:5432/code_editor"

# push the schema to your database
npm run db:push

# generate prisma client
npm run db:generate

# start the dev server
npm run dev
```

The app will be running at [http://localhost:3000](http://localhost:3000).

### Docker Deployment

You can also run the app using Docker Compose:

```bash
# configure environment variables
cp .env.example .env

# start the services
docker compose up -d

# view logs
docker compose logs -f
```

### How to use

1. Open the app, enter your name and email to get started
2. Create a new document or join an existing one by pasting its ID
3. Share the document ID with others so they can join
4. Start coding together - you'll see each other's cursors in real-time

## Architecture

```
├── server.ts              # custom http server with socket.io
├── prisma/
│   └── schema.prisma      # database models
├── src/
│   ├── app/               # next.js pages and api routes
│   │   ├── api/
│   │   │   ├── auth/      # user registration
│   │   │   └── documents/ # document CRUD
│   │   ├── editor/[id]/   # editor page
│   │   └── page.tsx       # dashboard
│   ├── components/
│   │   ├── Editor.tsx      # codemirror editor with OT
│   │   └── PresenceBar.tsx # collaborator avatars & status
│   ├── hooks/
│   │   ├── useSocket.ts    # socket.io client hook
│   │   └── useAutosave.ts  # debounced save hook
│   └── lib/
│       ├── collaboration.ts # OT engine 
│       ├── prisma.ts       # database client
│       └── types.ts        # shared types
```

## How the collaboration works

The editor uses Operational Transform (OT) for conflict resolution. When a user types:

1. The change is captured as operations (insert/delete at position)
2. Operations are sent to the server via WebSocket
3. Server transforms the operation against any concurrent changes
4. Transformed operation is broadcasted to all other users
5. Remote operations are applied to their editor without disrupting their cursor

The server keeps the last 100 operations in memory for transformation. In production, you'd want to use Redis for this.

## Known limitations

- No real authentication (it's a demo, not using bcrypt or JWTs)
- In-memory document state (would need Redis for horizontal scaling)
- No file system / multi-file support yet
- Undo/redo across collaborative sessions can be wonky
- **Code Execution**: Currently disabled in production builds due to a build tool issue. Works in development mode.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | - |
| `NEXTAUTH_SECRET` | Secret for auth (any string) | - |
| `NEXTAUTH_URL` | URL of the app | `http://localhost:3000` |
| `ALLOWED_ORIGINS` | Comma-separated list of allowed CORS origins | `*` (dev) |
| `DISABLE_CODE_EXEC` | Set to `true` to disable code execution | `false` |
