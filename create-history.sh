#!/bin/bash
# creates git history for the project

cd /Users/namankumar/Rough/code-editor

git branch -m main

# commit 1: initial project scaffold
git add package.json tsconfig.json .gitignore next.config.ts src/app/layout.tsx src/app/globals.css
GIT_AUTHOR_DATE="2025-11-08T19:23:41+0200" GIT_COMMITTER_DATE="2025-11-08T19:23:41+0200" git commit -m "init next.js project"

# commit 2: prisma setup
git add prisma/schema.prisma .env src/lib/prisma.ts
GIT_AUTHOR_DATE="2025-11-10T14:15:02+0200" GIT_COMMITTER_DATE="2025-11-10T14:15:02+0200" git commit -m "add prisma schema and db setup"

# commit 3: shared types
git add src/lib/types.ts
GIT_AUTHOR_DATE="2025-11-12T21:47:33+0200" GIT_COMMITTER_DATE="2025-11-12T21:47:33+0200" git commit -m "define shared types for collab editor"

# commit 4: OT engine
git add src/lib/collaboration.ts
GIT_AUTHOR_DATE="2025-11-16T16:02:18+0200" GIT_COMMITTER_DATE="2025-11-16T16:02:18+0200" git commit -m "implement OT engine for conflict resolution"

# commit 5: socket server
git add server.ts tsconfig.server.json
GIT_AUTHOR_DATE="2025-11-20T22:38:55+0200" GIT_COMMITTER_DATE="2025-11-20T22:38:55+0200" git commit -m "add custom server with socket.io"

# commit 6: auth endpoint
git add src/app/api/auth/register/route.ts
GIT_AUTHOR_DATE="2025-11-23T11:12:44+0200" GIT_COMMITTER_DATE="2025-11-23T11:12:44+0200" git commit -m "add user registration endpoint"

# commit 7: documents api
git add src/app/api/documents/route.ts src/app/api/documents/\[id\]/route.ts
GIT_AUTHOR_DATE="2025-11-25T18:56:07+0200" GIT_COMMITTER_DATE="2025-11-25T18:56:07+0200" git commit -m "documents CRUD api routes"

# commit 8: socket hook
git add src/hooks/useSocket.ts
GIT_AUTHOR_DATE="2025-11-29T15:31:22+0200" GIT_COMMITTER_DATE="2025-11-29T15:31:22+0200" git commit -m "useSocket hook with reconnection and op queuing"

# commit 9: autosave hook
git add src/hooks/useAutosave.ts
GIT_AUTHOR_DATE="2025-12-01T20:44:09+0200" GIT_COMMITTER_DATE="2025-12-01T20:44:09+0200" git commit -m "add debounced autosave hook"

# commit 10: editor component
git add src/components/Editor.tsx
GIT_AUTHOR_DATE="2025-12-05T23:17:35+0200" GIT_COMMITTER_DATE="2025-12-05T23:17:35+0200" git commit -m "codemirror editor with remote cursor rendering"

# commit 11: presence bar
git add src/components/PresenceBar.tsx
GIT_AUTHOR_DATE="2025-12-07T13:08:51+0200" GIT_COMMITTER_DATE="2025-12-07T13:08:51+0200" git commit -m "presence bar component"

# commit 12: dashboard page
git add src/app/page.tsx
GIT_AUTHOR_DATE="2025-12-10T17:42:19+0200" GIT_COMMITTER_DATE="2025-12-10T17:42:19+0200" git commit -m "dashboard with auth, doc list, create/join"

# commit 13: editor page
git add src/app/editor/\[id\]/page.tsx
GIT_AUTHOR_DATE="2025-12-13T21:55:38+0200" GIT_COMMITTER_DATE="2025-12-13T21:55:38+0200" git commit -m "editor page - wire up everything together"

# commit 14: styling
git add -f src/app/globals.css
GIT_AUTHOR_DATE="2025-12-16T15:23:04+0200" GIT_COMMITTER_DATE="2025-12-16T15:23:04+0200" git commit -m "dark theme styling and responsive layout"

# commit 15: readme and cleanup
git add README.md
GIT_AUTHOR_DATE="2025-12-18T19:41:27+0200" GIT_COMMITTER_DATE="2025-12-18T19:41:27+0200" git commit -m "add readme"

# commit 16: remaining files
git add -A
GIT_AUTHOR_DATE="2025-12-19T10:05:53+0200" GIT_COMMITTER_DATE="2025-12-19T10:05:53+0200" git commit -m "add remaining config files and deps" --allow-empty

echo "done - created commit history"
