"use client";

import { useCallback, useEffect, useState } from "react";
import { Sparkles, Trash2, Copy, Check, Link2 } from "lucide-react";
import { ListSkeleton } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { formatDateTime } from "@/lib/format";

type InsightItem = { id: string; title: string; body: string; topic: string; createdAt: string };
type Connector = { active: boolean; createdAt: string | null; lastUsedAt: string | null };

const TOPIC_STYLE: Record<string, string> = {
  הוצאות: "bg-red-50 text-red-700",
  הכנסות: "bg-emerald-50 text-emerald-700",
  כללי: "bg-slate-100 text-slate-600",
};

export default function InsightsPage() {
  const [items, setItems] = useState<InsightItem[] | null>(null);
  const [connector, setConnector] = useState<Connector | null>(null);
  const [newUrl, setNewUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([fetch("/api/insights"), fetch("/api/insights/connector")]);
      if (a.ok) setItems(await a.json());
      if (b.ok) setConnector(await b.json());
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

  async function createLink() {
    if (connector?.active && !confirm("יצירת קישור חדש מבטלת את הקישור הקודם (צריך לעדכן אותו ב-Claude). להמשיך?")) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/insights/connector", { method: "POST" });
      if (!res.ok) throw new Error();
      const { url } = await res.json();
      setNewUrl(url);
      setCopied(false);
      await load();
    } catch {
      setError("יצירת הקישור נכשלה");
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    if (!confirm("לבטל את החיבור ל-Claude? הוא יפסיק לקרוא ולכתוב נתונים.")) return;
    setBusy(true);
    await fetch("/api/insights/connector", { method: "DELETE" });
    setNewUrl("");
    await load();
    setBusy(false);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(newUrl);
      setCopied(true);
    } catch {
      setError("ההעתקה נכשלה, סמן והעתק ידנית");
    }
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
          text='חבר את Claude (בהמשך העמוד), ואז בשיחה עם Claude כתוב למשל: "נתח את ההוצאות שלי בחצי השנה האחרונה ושמור את התובנות באפליקציה".'
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

      <section className="card p-4 space-y-3">
        <h2 className="font-bold flex items-center gap-2">
          <Link2 size={18} /> חיבור Claude לאפליקציה
        </h2>
        <p className="text-xs text-slate-500">
          הקישור נותן ל-Claude לקרוא את ההוצאות וההכנסות שלך ולשמור כאן תובנות. הוא עובד על המנוי הרגיל שלך ב-Claude ולא דורש תשלום נפרד. מי שמחזיק בקישור יכול לקרוא את הנתונים, ולכן שמור אותו בסוד.
        </p>
        {connector?.active ? (
          <p className="text-xs text-emerald-700">
            חיבור פעיל מאז {connector.createdAt ? formatDateTime(connector.createdAt) : ""}
            {connector.lastUsedAt ? ` · שימוש אחרון ${formatDateTime(connector.lastUsedAt)}` : " · עוד לא נעשה בו שימוש"}
          </p>
        ) : (
          <p className="text-xs text-slate-500">אין חיבור פעיל.</p>
        )}

        {newUrl && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 space-y-2">
            <p className="text-xs font-medium text-amber-800">הקישור מוצג פעם אחת בלבד. העתק אותו עכשיו:</p>
            <p dir="ltr" className="text-xs break-all bg-white rounded-lg p-2 select-all">
              {newUrl}
            </p>
            <button type="button" onClick={copy} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-sm font-medium">
              {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "הועתק" : "העתק"}
            </button>
          </div>
        )}

        <ol className="text-xs text-slate-600 list-decimal pr-5 space-y-1">
          <li>צור קישור חיבור (הכפתור למטה) והעתק אותו.</li>
          <li>ב-Claude: הגדרות ← Connectors ← Add custom connector (חיבור מותאם אישית), הדבק את הקישור ושמור.</li>
          <li>בשיחה חדשה ב-Claude הפעל את החיבור וכתוב מה לנתח. התובנות יופיעו בעמוד הזה.</li>
        </ol>

        <div className="flex gap-2">
          <button type="button" disabled={busy} onClick={createLink} className="btn-primary text-sm disabled:opacity-50">
            {connector?.active ? "יצירת קישור חדש" : "יצירת קישור חיבור"}
          </button>
          {connector?.active && (
            <button type="button" disabled={busy} onClick={revoke} className="px-4 py-2 rounded-xl border border-red-200 text-red-700 text-sm font-medium disabled:opacity-50">
              ביטול החיבור
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
