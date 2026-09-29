"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Star,
  Download,
  ExternalLink as ExternalLinkIcon,
  ArrowRight,
  Plus,
  Trash2,
  Save,
} from "lucide-react";
import { formatDateTime, formatCurrency } from "@/lib/format";

type CustomField = { key: string; value: string };

type DocData = {
  _id: string;
  title: string;
  category: string;
  subcategory?: string;
  notes?: string;
  externalLink?: string;
  isImportant: boolean;
  customFields: CustomField[];
  amount?: number;
  isMonthlyPayment?: boolean;
  monthlyAmount?: number;
  fileId?: string;
  fileName?: string;
  fileMimeType?: string;
  uploadedBy?: { name?: string } | null;
  uploadedAt: string;
  lastOpenedAt: string;
};

export function DocumentDetail({ doc: initialDoc }: { doc: DocData }) {
  const router = useRouter();
  const [doc, setDoc] = useState(initialDoc);
  const [notes, setNotes] = useState(initialDoc.notes || "");
  const [customFields, setCustomFields] = useState<CustomField[]>(initialDoc.customFields || []);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  async function patch(update: Record<string, unknown>) {
    const res = await fetch(`/api/documents/${doc._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(update),
    });
    if (res.ok) {
      const updated = await res.json();
      setDoc((prev) => ({ ...prev, ...updated }));
    }
    return res.ok;
  }

  async function toggleImportant() {
    const next = !doc.isImportant;
    setDoc((prev) => ({ ...prev, isImportant: next }));
    await patch({ isImportant: next });
  }

  async function handleSave() {
    setSaving(true);
    setSavedMsg("");
    const ok = await patch({
      notes,
      customFields: customFields.filter((cf) => cf.key.trim()),
    });
    setSaving(false);
    setSavedMsg(ok ? "נשמר" : "שגיאה בשמירה");
    setTimeout(() => setSavedMsg(""), 2000);
  }

  async function handleDelete() {
    if (!confirm("למחוק את המסמך הזה לצמיתות?")) return;
    const res = await fetch(`/api/documents/${doc._id}`, { method: "DELETE" });
    if (res.ok) router.push(`/category/${encodeURIComponent(doc.category)}`);
  }

  function addField() {
    setCustomFields((prev) => [...prev, { key: "", value: "" }]);
  }
  function updateField(i: number, field: "key" | "value", val: string) {
    setCustomFields((prev) => prev.map((cf, idx) => (idx === i ? { ...cf, [field]: val } : cf)));
  }
  function removeField(i: number) {
    setCustomFields((prev) => prev.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-5">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowRight size={16} /> חזרה
      </button>

      <div className="card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">{doc.title}</h1>
            <p className="text-sm text-slate-500 mt-1">
              {doc.subcategory ? `${doc.category} · ${doc.subcategory}` : doc.category}
            </p>
          </div>
          <button
            onClick={toggleImportant}
            className="shrink-0 p-2 rounded-full hover:bg-amber-50"
            aria-label="סמן כחשוב"
          >
            <Star
              size={22}
              className={doc.isImportant ? "text-amber-500 fill-amber-500" : "text-slate-300"}
            />
          </button>
        </div>

        <div className="text-xs text-slate-400 mt-3 space-y-0.5">
          <p>הועלה ע&quot;י {doc.uploadedBy?.name || "לא ידוע"} · {formatDateTime(doc.uploadedAt)}</p>
          <p>נצפה לאחרונה: {formatDateTime(doc.lastOpenedAt)}</p>
        </div>

        {typeof doc.amount === "number" && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="bg-slate-100 rounded-full px-3 py-1 text-sm font-medium">
              סכום: {formatCurrency(doc.amount)}
            </span>
            {doc.isMonthlyPayment && (
              <span className="bg-teal-50 text-teal-700 rounded-full px-3 py-1 text-sm font-medium">
                תשלום חודשי: {formatCurrency(doc.monthlyAmount)}
              </span>
            )}
          </div>
        )}

        <div className="flex gap-2 mt-4">
          {doc.fileId && (
            <a
              href={`/api/files/${doc.fileId}`}
              target="_blank"
              rel="noreferrer"
              className="btn-primary flex items-center gap-2"
            >
              <Download size={16} /> צפייה / הורדה
            </a>
          )}
          {doc.externalLink && (
            <a
              href={doc.externalLink}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary flex items-center gap-2"
            >
              <ExternalLinkIcon size={16} /> קישור לפלטפורמה
            </a>
          )}
        </div>
      </div>

      <div className="card p-5">
        <label className="label">הערות</label>
        <textarea
          className="input min-h-[100px]"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-2">
          <label className="label mb-0">שדות מותאמים אישית</label>
          <button
            onClick={addField}
            type="button"
            className="text-teal-700 text-sm font-medium flex items-center gap-1"
          >
            <Plus size={16} /> הוסף שדה
          </button>
        </div>
        <div className="space-y-2">
          {customFields.length === 0 && (
            <p className="text-sm text-slate-400">אין שדות מותאמים אישית.</p>
          )}
          {customFields.map((cf, i) => (
            <div key={i} className="flex gap-2">
              <input
                className="input"
                placeholder="שם השדה"
                value={cf.key}
                onChange={(e) => updateField(i, "key", e.target.value)}
              />
              <input
                className="input"
                placeholder="ערך"
                value={cf.value}
                onChange={(e) => updateField(i, "value", e.target.value)}
              />
              <button
                type="button"
                onClick={() => removeField(i)}
                className="shrink-0 text-slate-400 hover:text-red-600"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
          <Save size={16} />
          {saving ? "שומר..." : "שמור שינויים"}
        </button>
        {savedMsg && <span className="text-sm text-emerald-600">{savedMsg}</span>}
        <button onClick={handleDelete} className="text-red-600 text-sm font-medium mr-auto">
          מחיקת מסמך
        </button>
      </div>
    </div>
  );
}
