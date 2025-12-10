"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { USER_COLORS } from "@/lib/types";

interface DocumentItem {
  id: string;
  title: string;
  language: string;
  updatedAt: string;
  collaborators: Array<{
    user: { name: string; avatarColor: string };
  }>;
}

export default function Dashboard() {
  const router = useRouter();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newLang, setNewLang] = useState("javascript");
  const [joinId, setJoinId] = useState("");
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [showAuth, setShowAuth] = useState(true);

  // check for cached user
  useEffect(() => {
    const cached = localStorage.getItem("collab-editor-user");
    if (cached) {
      const user = JSON.parse(cached);
      setUserId(user.id);
      setUserName(user.name);
      setUserEmail(user.email);
      setShowAuth(false);
    }
    setLoading(false);
  }, []);

  // load documents when user is set
  useEffect(() => {
    if (!userId) return;
    fetchDocuments();
  }, [userId]);

  async function fetchDocuments() {
    try {
      const res = await fetch("/api/documents");
      if (res.ok) {
        const docs = await res.json();
        setDocuments(docs);
      }
    } catch (err) {
      console.error("couldn't load docs:", err);
    }
  }

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    if (!userName.trim() || !userEmail.trim()) return;

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: userName.trim(), email: userEmail.trim() }),
      });

      if (res.ok) {
        const user = await res.json();
        localStorage.setItem("collab-editor-user", JSON.stringify(user));
        setUserId(user.id);
        setShowAuth(false);
      }
    } catch (err) {
      console.error("auth failed:", err);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();

    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim() || "Untitled",
          language: newLang,
          userId,
        }),
      });

      if (res.ok) {
        const doc = await res.json();
        router.push(`/editor/${doc.id}`);
      }
    } catch (err) {
      console.error("create failed:", err);
    }
  }

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (joinId.trim()) {
      router.push(`/editor/${joinId.trim()}`);
    }
  }

  function getTimeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  function getLangIcon(lang: string) {
    switch (lang) {
      case "javascript": return "JS";
      case "typescript": return "TS";
      case "python": return "PY";
      case "html": return "HTML";
      case "css": return "CSS";
      default: return "?";
    }
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
      </div>
    );
  }

  // show auth form if no user
  if (showAuth) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <div className="logo">
              <span className="logo-icon">⌘</span>
              <span className="logo-text">CodeSync</span>
            </div>
            <p className="auth-subtitle">Collaborative code editor</p>
          </div>

          <form onSubmit={handleAuth} className="auth-form">
            <div className="form-group">
              <label htmlFor="name">Name</label>
              <input
                id="name"
                type="text"
                placeholder="Your name"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
              />
            </div>
            <button type="submit" className="btn-primary">
              Get Started
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-left">
          <div className="logo">
            <span className="logo-icon">⌘</span>
            <span className="logo-text">CodeSync</span>
          </div>
        </div>
        <div className="header-right">
          <span className="user-greeting">Hey, {userName}</span>
          <button
            className="btn-ghost"
            onClick={() => {
              localStorage.removeItem("collab-editor-user");
              setShowAuth(true);
              setUserId(null);
            }}
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="dashboard-content">
        <div className="dashboard-actions">
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            + New Document
          </button>

          <form onSubmit={handleJoin} className="join-form">
            <input
              type="text"
              placeholder="Paste document ID to join..."
              value={joinId}
              onChange={(e) => setJoinId(e.target.value)}
              className="join-input"
            />
            <button type="submit" className="btn-secondary" disabled={!joinId.trim()}>
              Join
            </button>
          </form>
        </div>

        {/* create document modal */}
        {showCreate && (
          <div className="modal-overlay" onClick={() => setShowCreate(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h2>Create Document</h2>
              <form onSubmit={handleCreate}>
                <div className="form-group">
                  <label htmlFor="doc-title">Title</label>
                  <input
                    id="doc-title"
                    type="text"
                    placeholder="My awesome project"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="doc-lang">Language</label>
                  <select
                    id="doc-lang"
                    value={newLang}
                    onChange={(e) => setNewLang(e.target.value)}
                  >
                    <option value="javascript">JavaScript</option>
                    <option value="typescript">TypeScript</option>
                    <option value="python">Python</option>
                    <option value="html">HTML</option>
                    <option value="css">CSS</option>
                  </select>
                </div>
                <div className="modal-actions">
                  <button type="button" className="btn-ghost" onClick={() => setShowCreate(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary">
                    Create
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* document list */}
        <div className="doc-grid">
          {documents.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📝</div>
              <h3>No documents yet</h3>
              <p>Create your first document or join an existing one</p>
            </div>
          ) : (
            documents.map((doc) => (
              <div
                key={doc.id}
                className="doc-card"
                onClick={() => router.push(`/editor/${doc.id}`)}
              >
                <div className="doc-card-header">
                  <span className="lang-badge">{getLangIcon(doc.language)}</span>
                  <span className="doc-time">{getTimeAgo(doc.updatedAt)}</span>
                </div>
                <h3 className="doc-card-title">{doc.title}</h3>
                <div className="doc-card-footer">
                  <div className="doc-card-users">
                    {doc.collaborators.slice(0, 3).map((c, i) => (
                      <div
                        key={i}
                        className="mini-avatar"
                        style={{ background: c.user.avatarColor }}
                        title={c.user.name}
                      >
                        {c.user.name.charAt(0)}
                      </div>
                    ))}
                    {doc.collaborators.length > 3 && (
                      <span className="more-users">+{doc.collaborators.length - 3}</span>
                    )}
                  </div>
                  <span className="doc-id" title="Click to copy ID">
                    {doc.id.slice(0, 8)}…
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
