"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Users, Building2, Trash2 } from "lucide-react";

type WorkspaceRow = { _id: string; name: string; memberCount: number };
type UserRow = { _id: string; name: string; email: string; role: "admin" | "member" };

export default function AdminDashboard() {
  const [workspaces, setWorkspaces] = useState<WorkspaceRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadAll() {
    const [wsRes, usersRes] = await Promise.all([
      fetch("/api/admin/workspaces"),
      fetch("/api/admin/users"),
    ]);
    setWorkspaces(await wsRes.json());
    setUsers(await usersRes.json());
    setLoading(false);
  }

  useEffect(() => {
    // loadAll קורא ל-setState רק אחרי await (בתוך Promise.all), כלומר לא סינכרונית
    // בזמן ריצת ה-effect עצמו - בטוח מפני cascading renders.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAll();
  }, []);

  async function createWorkspace(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!newWorkspaceName.trim()) return;
    const res = await fetch("/api/admin/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newWorkspaceName.trim() }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "שגיאה");
      return;
    }
    setNewWorkspaceName("");
    loadAll();
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!newUser.name.trim() || !newUser.email.trim() || !newUser.password) return;
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newUser),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "שגיאה");
      return;
    }
    setNewUser({ name: "", email: "", password: "" });
    loadAll();
  }

  async function deleteUser(id: string) {
    if (!confirm("למחוק את המשתמש הזה? הוא יוסר מכל ה-workspace-ים שלו.")) return;
    const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "שגיאה");
      return;
    }
    loadAll();
  }

  if (loading) return <p className="text-slate-500">טוען...</p>;

  return (
    <div className="space-y-6">
      {error && <div className="bg-red-50 text-red-700 text-sm rounded-xl px-3 py-2">{error}</div>}

      <section className="card p-5">
        <h2 className="font-bold text-lg flex items-center gap-2 mb-3">
          <Building2 size={18} /> Workspaces
        </h2>
        <div className="space-y-2 mb-4">
          {workspaces.length === 0 && <p className="text-sm text-slate-400">אין workspace-ים עדיין.</p>}
          {workspaces.map((w) => (
            <Link
              key={w._id}
              href={`/admin/workspaces/${w._id}`}
              className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5 hover:bg-slate-50"
            >
              <span className="font-medium">{w.name}</span>
              <span className="text-sm text-slate-500 flex items-center gap-1">
                <Users size={14} /> {w.memberCount}
              </span>
            </Link>
          ))}
        </div>
        <form onSubmit={createWorkspace} className="flex gap-2">
          <input
            className="input"
            placeholder="שם workspace חדש"
            value={newWorkspaceName}
            onChange={(e) => setNewWorkspaceName(e.target.value)}
          />
          <button type="submit" className="btn-primary flex items-center gap-1 shrink-0">
            <Plus size={16} /> יצירה
          </button>
        </form>
      </section>

      <section className="card p-5">
        <h2 className="font-bold text-lg flex items-center gap-2 mb-3">
          <Users size={18} /> משתמשים
        </h2>
        <div className="space-y-2 mb-4">
          {users.length === 0 && <p className="text-sm text-slate-400">אין משתמשים עדיין.</p>}
          {users.map((u) => (
            <div
              key={u._id}
              className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5"
            >
              <div>
                <p className="font-medium">
                  {u.name} {u.role === "admin" && <span className="text-xs text-teal-700">(admin)</span>}
                </p>
                <p className="text-xs text-slate-500">{u.email}</p>
              </div>
              <button
                onClick={() => deleteUser(u._id)}
                className="text-slate-400 hover:text-red-600"
                aria-label="מחיקת משתמש"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>
        <form onSubmit={createUser} className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input
              className="input"
              placeholder="שם מלא"
              value={newUser.name}
              onChange={(e) => setNewUser((p) => ({ ...p, name: e.target.value }))}
            />
            <input
              type="email"
              className="input"
              placeholder="אימייל"
              value={newUser.email}
              onChange={(e) => setNewUser((p) => ({ ...p, email: e.target.value }))}
            />
          </div>
          <input
            type="password"
            className="input"
            placeholder="סיסמה (6 תווים לפחות)"
            value={newUser.password}
            onChange={(e) => setNewUser((p) => ({ ...p, password: e.target.value }))}
          />
          <button type="submit" className="btn-primary w-full flex items-center justify-center gap-1">
            <Plus size={16} /> יצירת משתמש
          </button>
        </form>
        <p className="text-xs text-slate-400 mt-2">
          לאחר יצירת המשתמש, שייך אותו ל-workspace המתאים מתוך עמוד ה-workspace.
        </p>
      </section>
    </div>
  );
}
