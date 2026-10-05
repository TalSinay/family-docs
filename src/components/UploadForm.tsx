"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Upload, FileText } from "lucide-react";
import { FINANCIAL_CATEGORIES, MAIN_CATEGORIES, MainCategory } from "@/lib/categories";
import { formatFileSize } from "@/lib/format";
import {
  EMPTY_FINANCE_VALUES,
  FinanceFieldsInputs,
  FinanceFormValues,
  financeValuesToPayload,
} from "./FinanceFieldsInputs";

type CustomField = { key: string; value: string };

// מגבלה מעשית לכל קובץ בודד - תואמת את ה-11MB שבצד השרת (api/files/upload).
const MAX_FILE_SIZE = 11 * 1024 * 1024;

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
  const [finance, setFinance] = useState<FinanceFormValues>(EMPTY_FINANCE_VALUES);
  const [dueDate, setDueDate] = useState("");
  const [dueDateTitle, setDueDateTitle] = useState("");
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/subcategories")
      .then((r) => r.json())
      .then(setSubcategories)
      .catch(() => {});
  }, []);

  const isFinancial = FINANCIAL_CATEGORIES.includes(category);
  const isFinanceCategory = category === "פיננסים";
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

  // מוסיף קבצים לרשימה הקיימת (ולא מחליף אותה) - כך אפשר לבחור קבצים בכמה
  // פעימות ("הוסף עוד קובץ") ולצרף כולם לאותה רשומה.
  function addFiles(selected: FileList | null) {
    if (!selected || selected.length === 0) return;
    const incoming = Array.from(selected);
    const tooBig = incoming.filter((f) => f.size > MAX_FILE_SIZE);
    if (tooBig.length > 0) {
      setError(`הקובץ "${tooBig[0].name}" גדול מדי (מקסימום כ-11MB לקובץ)`);
    }
    setFiles((prev) => [...prev, ...incoming.filter((f) => f.size <= MAX_FILE_SIZE)]);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
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
      // מעלים את הקבצים אחד-אחד (סדרתית, לא במקביל) כדי לא להציף את השרת
      // ולהציג בבירור איזה קובץ נכשל אם משהו משתבש.
      const attachments: { fileId: string; fileName: string; fileMimeType: string; fileSize: number }[] = [];
      for (const f of files) {
        const formData = new FormData();
        formData.append("file", f);
        const uploadRes = await fetch("/api/files/upload", { method: "POST", body: formData });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) {
          throw new Error(uploadData.error || `העלאת הקובץ "${f.name}" נכשלה`);
        }
        attachments.push(uploadData);
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
          attachments,
          ...(isFinanceCategory ? financeValuesToPayload(finance) : {}),
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

      {isFinanceCategory && <FinanceFieldsInputs values={finance} onChange={setFinance} />}

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
        <label className="label">קבצים מצורפים</label>

        {files.length > 0 && (
          <div className="space-y-1.5 mb-2">
            {files.map((f, i) => (
              <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
                <FileText size={16} className="text-slate-400 shrink-0" />
                <span className="text-sm text-slate-700 truncate flex-1">{f.name}</span>
                <span className="text-xs text-slate-400 shrink-0">{formatFileSize(f.size)}</span>
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="shrink-0 text-slate-400 hover:text-red-600"
                  aria-label="הסר קובץ"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}

        <label className="flex items-center gap-2 justify-center border-2 border-dashed border-slate-300 rounded-xl py-6 cursor-pointer hover:border-teal-500 transition-colors">
          <Upload size={20} className="text-slate-400" />
          <span className="text-sm text-slate-600">
            {files.length > 0 ? "הוסף עוד קובץ" : "לחץ לבחירת קובץ אחד או יותר (עד 11MB לקובץ)"}
          </span>
          <input
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      <button type="submit" disabled={submitting} className="btn-primary w-full">
        {submitting ? "שומר..." : "שמור רשומה"}
      </button>
    </form>
  );
}
