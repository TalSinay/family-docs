"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Upload } from "lucide-react";
import { FINANCIAL_CATEGORIES, MAIN_CATEGORIES, MainCategory } from "@/lib/categories";

type CustomField = { key: string; value: string };

export function UploadForm({
  initialCategory,
  onSuccess,
}: {
  initialCategory?: MainCategory;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [category, setCategory] = useState<MainCategory>(initialCategory || "כללי");
  const [subcategories, setSubcategories] = useState<Record<string, string[]>>({});
  const [subcategory, setSubcategory] = useState("");
  const [newSubcategory, setNewSubcategory] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [externalLink, setExternalLink] = useState("");
  const [amount, setAmount] = useState("");
  const [isMonthlyPayment, setIsMonthlyPayment] = useState(false);
  const [monthlyAmount, setMonthlyAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueDateTitle, setDueDateTitle] = useState("");
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/subcategories")
      .then((r) => r.json())
      .then(setSubcategories)
      .catch(() => {});
  }, []);

  const isFinancial = FINANCIAL_CATEGORIES.includes(category);
  const availableSubs = subcategories[category] || [];

  function addCustomField() {
    setCustomFields((prev) => [...prev, { key: "", value: "" }]);
  }

  function updateCustomField(i: number, field: "key" | "value", val: string) {
    setCustomFields((prev) => prev.map((cf, idx) => (idx === i ? { ...cf, [field]: val } : cf)));
  }

  function removeCustomField(i: number) {
    setCustomFields((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!title.trim()) {
      setError("צריך למלא כותרת");
      return;
    }

    setSubmitting(true);
    try {
      let fileId, fileName, fileMimeType, fileSize;

      if (file) {
        const formData = new FormData();
        formData.append("file", file);
        const uploadRes = await fetch("/api/files/upload", { method: "POST", body: formData });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) throw new Error(uploadData.error || "העלאת הקובץ נכשלה");
        ({ fileId, fileName, fileMimeType, fileSize } = uploadData);
      }

      const finalSubcategory = newSubcategory.trim() || subcategory || undefined;

      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          category,
          subcategory: finalSubcategory,
          notes: notes || undefined,
          externalLink: externalLink || undefined,
          customFields: customFields.filter((cf) => cf.key.trim()),
          dueDate: dueDate || undefined,
          dueDateTitle: dueDate ? dueDateTitle || undefined : undefined,
          amount: amount ? Number(amount) : undefined,
          isMonthlyPayment,
          monthlyAmount: isMonthlyPayment && monthlyAmount ? Number(monthlyAmount) : undefined,
          fileId,
          fileName,
          fileMimeType,
          fileSize,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "שמירת הרשומה נכשלה");
      }

      router.refresh();
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה לא צפויה");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 text-red-700 text-sm rounded-xl px-3 py-2">{error}</div>
      )}

      <div>
        <label className="label">קטגוריה</label>
        <select
          className="input"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value as MainCategory);
            setSubcategory("");
            setNewSubcategory("");
          }}
        >
          {MAIN_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {availableSubs.length > 0 && (
        <div>
          <label className="label">תת-קטגוריה</label>
          <select
            className="input"
            value={subcategory}
            onChange={(e) => setSubcategory(e.target.value)}
          >
            <option value="">— ללא —</option>
            {availableSubs.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="label">או תת-קטגוריה חדשה</label>
        <input
          className="input"
          placeholder="לדוגמה: ביטוח נסיעות"
          value={newSubcategory}
          onChange={(e) => setNewSubcategory(e.target.value)}
        />
      </div>

      <div>
        <label className="label">כותרת *</label>
        <input
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="לדוגמה: פוליסת ביטוח רכב 2026"
          required
        />
      </div>

      {isFinancial && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">סכום (₪)</label>
            <input
              type="number"
              step="0.01"
              className="input"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="flex flex-col justify-end">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-600 mb-1">
              <input
                type="checkbox"
                checked={isMonthlyPayment}
                onChange={(e) => setIsMonthlyPayment(e.target.checked)}
                className="rounded"
              />
              תשלום חודשי חוזר
            </label>
            {isMonthlyPayment && (
              <input
                type="number"
                step="0.01"
                className="input"
                placeholder="סכום חודשי"
                value={monthlyAmount}
                onChange={(e) => setMonthlyAmount(e.target.value)}
              />
            )}
          </div>
        </div>
      )}

      <div>
        <label className="label">קישור לפלטפורמה</label>
        <input
          type="url"
          className="input"
          placeholder="https://..."
          value={externalLink}
          onChange={(e) => setExternalLink(e.target.value)}
        />
      </div>

      <div>
        <label className="label">תאריך יעד (אופציונלי - יופיע ביומן)</label>
        <input
          type="date"
          className="input"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
        {dueDate && (
          <input
            className="input mt-2"
            placeholder="כותרת שתוצג ביומן (לדוגמה: לחדש ביטוח רכב)"
            value={dueDateTitle}
            onChange={(e) => setDueDateTitle(e.target.value)}
          />
        )}
      </div>

      <div>
        <label className="label">הערות</label>
        <textarea
          className="input min-h-[80px]"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="label mb-0">שדות מותאמים אישית</label>
          <button
            type="button"
            onClick={addCustomField}
            className="text-teal-700 text-sm font-medium flex items-center gap-1"
          >
            <Plus size={16} /> הוסף שדה
          </button>
        </div>
        <div className="space-y-2">
          {customFields.map((cf, i) => (
            <div key={i} className="flex gap-2">
              <input
                className="input"
                placeholder="שם השדה (לדוגמה: תאריך סיום)"
                value={cf.key}
                onChange={(e) => updateCustomField(i, "key", e.target.value)}
              />
              <input
                className="input"
                placeholder="ערך"
                value={cf.value}
                onChange={(e) => updateCustomField(i, "value", e.target.value)}
              />
              <button
                type="button"
                onClick={() => removeCustomField(i)}
                className="shrink-0 text-slate-400 hover:text-red-600"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className="label">קובץ מצורף</label>
        <label className="flex items-center gap-2 justify-center border-2 border-dashed border-slate-300 rounded-xl py-6 cursor-pointer hover:border-teal-500 transition-colors">
          <Upload size={20} className="text-slate-400" />
          <span className="text-sm text-slate-600">
            {file ? file.name : "לחץ לבחירת קובץ (עד 11MB)"}
          </span>
          <input
            type="file"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </label>
      </div>

      <button type="submit" disabled={submitting} className="btn-primary w-full">
        {submitting ? "שומר..." : "שמור רשומה"}
      </button>
    </form>
  );
}
