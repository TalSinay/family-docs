"use client";

import { useCallback, useEffect, useState } from "react";
import { Sparkles, Trash2 } from "lucide-react";
import { ListSkeleton } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { formatDateTime } from "@/lib/format";

type InsightItem = { id: string; title: string; body: string; topic: string; createdAt: string };

const TOPIC_STYLE: Record<string, string> = {
  הוצאות: "bg-red-50 text-red-700",
  הכנסות: "bg-emerald-50 text-emerald-700",
  כללי: "bg-slate-100 text-slate-600",
};

export default function InsightsPage() {
  const [items, setItems] = useState<InsightItem[] | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const a = await fetch("/api/insights");
      if (a.ok) setItems(await a.json());
    } catch {
      setError("הטעינה נכשלה");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- טעינה ראשונית של התובנות והחיבור
    load();
  }, [load]);

  async function remove(id: string) {
    if (!confirm("למחוק את התובנה?")) return;
    await fetch(`/api/insights?id=${id}`, { method: "DELETE" });
    setItems((cur) => (cur ? cur.filter((i) => i.id !== id) : cur));
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Sparkles size={20} className="text-amber-500" /> תובנות
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">תובנות על ההוצאות וההכנסות שלך, שנשמרות כאן כשאתה מבקש מ-Claude לנתח אותן.</p>
      </div>

      {error && <div className="bg-red-50 text-red-700 text-sm rounded-xl px-3 py-2">{error}</div>}
      {!items && !error && <ListSkeleton rows={3} />}

      {items && items.length === 0 && (
        <EmptyState
          title="עוד אין תובנות"
          text='בשיחה עם Claude (כשהחיבור פעיל) כתוב למשל: "נתח את ההוצאות שלי בחצי השנה האחרונה ושמור את התובנות באפליקציה".'
        />
      )}

      {items?.map((i) => (
        <article key={i.id} className="card p-4 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-bold">{i.title}</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                <span className={`inline-block rounded-full px-2 py-0.5 ml-2 ${TOPIC_STYLE[i.topic] ?? TOPIC_STYLE["כללי"]}`}>{i.topic}</span>
                {formatDateTime(i.createdAt)}
              </p>
            </div>
            <button type="button" onClick={() => remove(i.id)} className="p-2 rounded-full text-slate-400 hover:bg-slate-100 hover:text-red-600" aria-label="מחיקת תובנה">
              <Trash2 size={18} />
            </button>
          </div>
          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{i.body}</p>
        </article>
      ))}
    </div>
  );
}
