"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { ArrowRight, Trash2, Plus, Save } from "lucide-react";
import { DEFAULT_SUBCATEGORIES } from "@/lib/categories";

type Member = {
  _id: string;
  userId: { _id: string; name: string; email: string; role: string };
  displayName?: string;
};
type UserRow = { _id: string; name: string; email: string };

export default function WorkspaceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [name, setName] = useState("");
  const [generalLabels, setGeneralLabels] = useState<string[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [allUsers, setAllUsers] = useState<UserRow[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [displayNameEdits, setDisplayNameEdits] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [labelsSavedMsg, setLabelsSavedMsg] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadAll() {
    const [wsRes, membersRes, usersRes] = await Promise.all([
      fetch("/api/admin/workspaces"),
      fetch(`/api/admin/workspaces/${id}/members`),
      fetch("/api/admin/users"),
    ]);
    const workspaces = await wsRes.json();
    const ws = workspaces.find((w: { _id: string; name: string }) => w._id === id);
    setName(ws?.name || "");
    setGeneralLabels(
      ws?.generalLabels?.length ? ws.generalLabels : [...DEFAULT_SUBCATEGORIES["כללי"]]
    );
    const membersData: Member[] = await membersRes.json();
    setMembers(membersData);
    setDisplayNameEdits(
      Object.fromEntries(membersData.map((m) => [m.userId._id, m.displayName || ""]))
    );
    setAllUsers(await usersRes.json());
    setLoading(false);
  }

  useEffect(() => {
    // loadAll קורא ל-setState רק אחרי await, כלומר לא סינכרונית בזמן ריצת ה-effect עצמו.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const memberUserIds = new Set(members.map((m) => m.userId._id));
  const availableUsers = allUsers.filter((u) => !memberUserIds.has(u._id));

  async function renameWorkspace(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch(`/api/admin/workspaces/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error || "שגיאה");
  }

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!selectedUserId) return;
    const res = await fetch(`/api/admin/workspaces/${id}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: selectedUserId, displayName: newDisplayName || undefined }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "שגיאה");
      return;
    }
    setSelectedUserId("");
    setNewDisplayName("");
    loadAll();
  }

  async function saveDisplayName(userId: string) {
    setError("");
    const res = await fetch(`/api/admin/workspaces/${id}/members/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: displayNameEdits[userId] || "" }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "שגיאה");
      return;
    }
    loadAll();
  }

  function updateGeneralLabel(i: number, value: string) {
    setGeneralLabels((prev) => prev.map((l, idx) => (idx === i ? value : l)));
  }
  function addGeneralLabel() {
    setGeneralLabels((prev) => [...prev, ""]);
  }
  function removeGeneralLabel(i: number) {
    setGeneralLabels((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function saveGeneralLabels(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLabelsSavedMsg("");
    const res = await fetch(`/api/admin/workspaces/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ generalLabels: generalLabels.filter((l) => l.trim()) }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "שגיאה");
      return;
    }
    setLabelsSavedMsg("נשמר");
    setTimeout(() => setLabelsSavedMsg(""), 2000);
    loadAll();
  }

  async function removeMember(userId: string) {
    if (!confirm("להסיר את המשתמש מה-workspace הזה?")) return;
    const res = await fetch(`/api/admin/workspaces/${id}/members/${userId}`, {
      method: "DELETE",
    });
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
      <Link href="/admin" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowRight size={16} /> חזרה לרשימת workspace-ים
      </Link>

      {error && <div className="bg-red-50 text-red-700 text-sm rounded-xl px-3 py-2">{error}</div>}

      <section className="card p-5">
        <label className="label">שם ה-workspace</label>
        <form onSubmit={renameWorkspace} className="flex gap-2">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          <button type="submit" className="btn-primary flex items-center gap-1 shrink-0">
            <Save size={16} /> שמירה
          </button>
        </form>
      </section>

      <section className="card p-5">
        <label className="label">תוויות מותאמות בקטגוריית &quot;כללי&quot;</label>
        <p className="text-xs text-slate-400 mb-3">
          אלו תתי-הקטגוריות המוצעות בקטגוריית &quot;כללי&quot; עבור ה-workspace הזה בלבד (לדוגמה
          שמות בני המשפחה) - אפשר לשנות אותן בלי להשפיע על workspace-ים אחרים.
        </p>
        <form onSubmit={saveGeneralLabels} className="space-y-2">
          {generalLabels.map((label, i) => (
            <div key={i} className="flex gap-2">
              <input
                className="input"
                value={label}
                onChange={(e) => updateGeneralLabel(i, e.target.value)}
                placeholder="לדוגמה: מסמכים דן"
              />
              <button
                type="button"
                onClick={() => removeGeneralLabel(i)}
                className="shrink-0 text-slate-400 hover:text-red-600"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={addGeneralLabel}
              className="text-teal-700 text-sm font-medium flex items-center gap-1"
            >
              <Plus size={16} /> הוספת תווית
            </button>
            <button type="submit" className="btn-secondary flex items-center gap-1 mr-auto">
              <Save size={16} /> שמירה
            </button>
            {labelsSavedMsg && <span className="text-sm text-emerald-600">{labelsSavedMsg}</span>}
          </div>
        </form>
      </section>

      <section className="card p-5">
        <h2 className="font-bold text-lg mb-3">חברי ה-workspace</h2>
        <div className="space-y-3 mb-4">
          {members.length === 0 && <p className="text-sm text-slate-400">אין חברים עדיין.</p>}
          {members.map((m) => (
            <div key={m._id} className="rounded-xl border border-slate-200 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{m.userId.name}</p>
                  <p className="text-xs text-slate-500">{m.userId.email}</p>
                </div>
                <button
                  onClick={() => removeMember(m.userId._id)}
                  className="text-slate-400 hover:text-red-600"
                  aria-label="הסרה מה-workspace"
                >
                  <Trash2 size={18} />
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  className="input"
                  placeholder={`שם תצוגה ב-workspace הזה (ברירת מחדל: ${m.userId.name})`}
                  value={displayNameEdits[m.userId._id] ?? ""}
                  onChange={(e) =>
                    setDisplayNameEdits((p) => ({ ...p, [m.userId._id]: e.target.value }))
                  }
                />
                <button
                  onClick={() => saveDisplayName(m.userId._id)}
                  className="btn-secondary shrink-0"
                >
                  שמירה
                </button>
              </div>
            </div>
          ))}
        </div>

        {availableUsers.length > 0 ? (
          <form onSubmit={addMember} className="space-y-2 border-t border-slate-200 pt-4">
            <label className="label">הוספת משתמש קיים</label>
            <select
              className="input"
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
            >
              <option value="">בחר משתמש...</option>
              {availableUsers.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>
            <input
              className="input"
              placeholder="שם תצוגה ב-workspace (אופציונלי)"
              value={newDisplayName}
              onChange={(e) => setNewDisplayName(e.target.value)}
            />
            <button type="submit" className="btn-primary w-full flex items-center justify-center gap-1">
              <Plus size={16} /> הוספה ל-workspace
            </button>
          </form>
        ) : (
          <p className="text-sm text-slate-400 border-t border-slate-200 pt-4">
            כל המשתמשים כבר חברים ב-workspace הזה. אפשר ליצור משתמש חדש מהעמוד הראשי.
          </p>
        )}
      </section>
    </div>
  );
}
