"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { ShoppingCart, Plus, Trash2, CheckCircle2 } from "lucide-react";

type ShoppingListItem = {
  _id: string;
  inCart: boolean;
};

type ShoppingListSummary = {
  _id: string;
  title: string;
  items: ShoppingListItem[];
  isCompleted: boolean;
  createdBy?: { name?: string } | null;
  createdAt: string;
};

export default function ShoppingListsPage() {
  // ה-workspace הפעיל, כדי שמעבר בין workspace-ים ירענן מיד את רשימות הקניות.
  const { data: session } = useSession();
  const activeWorkspaceId = session?.user?.activeWorkspaceId;
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [lists, setLists] = useState<ShoppingListSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- רק קובע שהרכיב עלה בדפדפן
    setMounted(true);
  }, []);

  const fetchLists = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/shopping-lists");
      if (res.ok) setLists(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- טעינת רשימות לפי workspace, לא לולאת render
    fetchLists();
  }, [mounted, fetchLists, activeWorkspaceId]);

  async function createList() {
    setCreating(true);
    try {
      const res = await fetch("/api/shopping-lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const list = await res.json();
        router.push(`/shopping/${list._id}`);
      }
    } finally {
      setCreating(false);
    }
  }

  async function deleteList(id: string) {
    if (!confirm("למחוק את רשימת הקניות הזו לצמיתות?")) return;
    setLists((prev) => prev.filter((l) => l._id !== id));
    await fetch(`/api/shopping-lists/${id}`, { method: "DELETE" });
  }

  if (!mounted) {
    return <div className="card p-8 text-center text-sm text-slate-400">טוען רשימות קניות...</div>;
  }

  const active = lists.filter((l) => !l.isCompleted);
  const completed = lists.filter((l) => l.isCompleted);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">קניות</h1>
          <p className="text-sm text-slate-500">רשימות קניות - אחת לכל יום/ביקור</p>
        </div>
        <button
          onClick={createList}
          disabled={creating}
          className="btn-primary flex items-center gap-2 disabled:opacity-60"
        >
          <Plus size={16} /> רשימה חדשה
        </button>
      </div>

      {loading && <p className="text-sm text-slate-400 text-center py-8">טוען...</p>}

      {!loading && (
        <div className="space-y-4">
          {active.length === 0 && completed.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-8">
              אין רשימות קניות עדיין. צור אחת למעלה.
            </p>
          )}

          {active.length > 0 && (
            <div className="space-y-2">
              {active.map((list) => (
                <ShoppingListRow key={list._id} list={list} onDelete={deleteList} />
              ))}
            </div>
          )}

          {completed.length > 0 && (
            <div className="pt-2">
              <p className="text-xs text-slate-400 font-medium mb-2">הושלמו</p>
              <div className="space-y-2">
                {completed.map((list) => (
                  <ShoppingListRow key={list._id} list={list} onDelete={deleteList} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ShoppingListRow({
  list,
  onDelete,
}: {
  list: ShoppingListSummary;
  onDelete: (id: string) => void;
}) {
  const total = list.items.length;
  const inCartCount = list.items.filter((i) => i.inCart).length;

  return (
    <Link
      href={`/shopping/${list._id}`}
      className="card flex items-center gap-3 p-4 hover:border-teal-300 transition-colors"
    >
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
          list.isCompleted ? "bg-emerald-50 text-emerald-700" : "bg-teal-50 text-teal-700"
        }`}
      >
        {list.isCompleted ? <CheckCircle2 size={18} /> : <ShoppingCart size={18} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`font-medium truncate ${list.isCompleted ? "text-slate-500" : ""}`}>
          {list.title}
        </p>
        <p className="text-xs text-slate-500 mt-0.5">
          {total === 0 ? "אין פריטים עדיין" : `${inCartCount} מתוך ${total} בעגלה`}
        </p>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          onDelete(list._id);
        }}
        className="shrink-0 text-slate-400 hover:text-red-600 p-1"
        aria-label="מחיקת רשימה"
      >
        <Trash2 size={18} />
      </button>
    </Link>
  );
}
