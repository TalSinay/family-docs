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
  Upload,
  FileText,
} from "lucide-react";
import { formatDateTime, formatCurrency, formatFileSize } from "@/lib/format";
import { FINANCIAL_CATEGORIES } from "@/lib/categories";
import {
  FinanceFieldsInputs,
  FinanceFormValues,
  financeValuesToPayload,
} from "./FinanceFieldsInputs";

type CustomField = { key: string; value: string };

type Attachment = {
  fileId: string;
  fileName: string;
  fileMimeType: string;
  fileSize: number;
};

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
  platformName?: string;
  expectedReturn?: number;
  commissionFee?: number;
  targetAmount?: number;
  isLiability?: boolean;
  amountHistory?: { amount: number; at: string }[];
  dueDate?: string;
  dueDateTitle?: string;
  attachments?: Attachment[];
  // קובץ בודד ישן (מסמכים שנוצרו לפני תמיכה ב-attachments) - לתאימות לאחור בלבד
  fileId?: string;
  fileName?: string;
  fileMimeType?: string;
  fileSize?: number;
  uploadedBy?: { name?: string } | null;
  uploadedAt: string;
  lastOpenedAt: string;
};

const MAX_FILE_SIZE = 11 * 1024 * 1024;

export function DocumentDetail({ doc: initialDoc }: { doc: DocData }) {
  const router = useRouter();
  const [doc, setDoc] = useState(initialDoc);
  const [notes, setNotes] = useState(initialDoc.notes || "");
  const [customFields, setCustomFields] = useState<CustomField[]>(initialDoc.customFields || []);
  const [isMonthlyPayment, setIsMonthlyPayment] = useState(!!initialDoc.isMonthlyPayment);
  const [monthlyAmount, setMonthlyAmount] = useState(
    initialDoc.monthlyAmount != null ? String(initialDoc.monthlyAmount) : ""
  );
  const [amountInput, setAmountInput] = useState(
    initialDoc.amount != null ? String(initialDoc.amount) : ""
  );
  const [finance, setFinance] = useState<FinanceFormValues>({
    platformName: initialDoc.platformName || "",
    expectedReturn: initialDoc.expectedReturn != null ? String(initialDoc.expectedReturn) : "",
    commissionFee: initialDoc.commissionFee != null ? String(initialDoc.commissionFee) : "",
    targetAmount: initialDoc.targetAmount != null ? String(initialDoc.targetAmount) : "",
    isLiability: !!initialDoc.isLiability,
  });
  const [dueDate, setDueDate] = useState(initialDoc.dueDate || "");
  const [dueDateTitle, setDueDateTitle] = useState(initialDoc.dueDateTitle || "");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [attachError, setAttachError] = useState("");

  const isFinanceCategory = doc.category === "פיננסים";
  const isFinancial = FINANCIAL_CATEGORIES.includes(doc.category as (typeof FINANCIAL_CATEGORIES)[number]);

  // מסמכים חדשים נשמרים כולם ב-attachments; מסמכים ישנים (מלפני התמיכה בכמה
  // קבצים) מוצגים כאן כ"attachment" בודד לתאימות לאחור, עד שיוחלפו/יימחקו.
  const attachments: Attachment[] =
    doc.attachments && doc.attachments.length > 0
      ? doc.attachments
      : doc.fileId
      ? [
          {
            fileId: doc.fileId,
            fileName: doc.fileName || "קובץ מצורף",
            fileMimeType: doc.fileMimeType || "application/octet-stream",
            fileSize: doc.fileSize || 0,
          },
        ]
      : [];
  const isLegacySingleFile = !doc.attachments?.length && !!doc.fileId;

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

  async function addFiles(selected: FileList | null) {
    if (!selected || selected.length === 0) return;
    setAttachError("");
    const incoming = Array.from(selected);
    const tooBig = incoming.find((f) => f.size > MAX_FILE_SIZE);
    if (tooBig) {
      setAttachError(`הקובץ "${tooBig.name}" גדול מדי (מקסימום כ-11MB לקובץ)`);
      return;
    }

    setUploadingFiles(true);
    try {
      const newAttachments: Attachment[] = [];
      for (const f of incoming) {
        const formData = new FormData();
        formData.append("file", f);
        const res = await fetch("/api/files/upload", { method: "POST", body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `העלאת הקובץ "${f.name}" נכשלה`);
        newAttachments.push(data);
      }
      const combined = [...attachments, ...newAttachments];
      const ok = await patch(
        isLegacySingleFile ? { attachments: combined, fileId: null } : { attachments: combined }
      );
      if (!ok) setAttachError("שגיאה בשמירת הקבצים");
    } catch (err) {
      setAttachError(err instanceof Error ? err.message : "שגיאה לא צפויה");
    } finally {
      setUploadingFiles(false);
    }
  }

  async function removeAttachment(fileId: string) {
    if (!confirm("להסיר את הקובץ הזה מהרשומה?")) return;
    const remaining = attachments.filter((a) => a.fileId !== fileId);
    await patch(
      isLegacySingleFile ? { attachments: remaining, fileId: null } : { attachments: remaining }
    );
  }

  async function handleSave() {
    setSaving(true);
    setSavedMsg("");
    const ok = await patch({
      notes,
      customFields: customFields.filter((cf) => cf.key.trim()),
      isMonthlyPayment,
      monthlyAmount: isMonthlyPayment && monthlyAmount ? Number(monthlyAmount) : undefined,
      dueDate: dueDate || "",
      dueDateTitle: dueDate ? dueDateTitle || undefined : undefined,
      ...(isFinanceCategory
        ? {
            amount: amountInput.trim() === "" ? null : Number(amountInput),
            ...financeValuesToPayload(finance),
          }
        : {}),
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

        {!isFinanceCategory && typeof doc.amount === "number" && (
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

        {doc.externalLink && (
          <div className="flex gap-2 mt-4">
            <a
              href={doc.externalLink}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary flex items-center gap-2"
            >
              <ExternalLinkIcon size={16} /> קישור לפלטפורמה
            </a>
          </div>
        )}
      </div>

      <div className="card p-5">
        <label className="label">קבצים מצורפים</label>

        {attachments.length === 0 && (
          <p className="text-sm text-slate-400 mb-2">אין קבצים מצורפים עדיין.</p>
        )}

        {attachments.length > 0 && (
          <div className="space-y-1.5 mb-3">
            {attachments.map((a) => (
              <div key={a.fileId} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
                <FileText size={16} className="text-slate-400 shrink-0" />
                <a
                  href={`/api/files/${a.fileId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-teal-700 hover:underline truncate flex-1 flex items-center gap-1"
                >
                  <Download size={14} className="shrink-0" /> {a.fileName}
                </a>
                {a.fileSize > 0 && (
                  <span className="text-xs text-slate-400 shrink-0">{formatFileSize(a.fileSize)}</span>
                )}
                <button
                  type="button"
                  onClick={() => removeAttachment(a.fileId)}
                  className="shrink-0 text-slate-400 hover:text-red-600"
                  aria-label="הסר קובץ"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}

        {attachError && <p className="text-sm text-red-600 mb-2">{attachError}</p>}

        <label className="flex items-center gap-2 justify-center border-2 border-dashed border-slate-300 rounded-xl py-4 cursor-pointer hover:border-teal-500 transition-colors">
          <Upload size={18} className="text-slate-400" />
          <span className="text-sm text-slate-600">
            {uploadingFiles ? "מעלה..." : "הוסף קובץ (אפשר לבחור כמה בבת אחת)"}
          </span>
          <input
            type="file"
            multiple
            disabled={uploadingFiles}
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      <div className="card p-5">
        <label className="label">תאריך יעד (מופיע ביומן)</label>
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

      {isFinanceCategory && (
        <div className="card p-5 space-y-3">
          <div>
            <label className="label">סכום נוכחי (₪)</label>
            <input
              type="number"
              step="0.01"
              inputMode="decimal"
              className="input"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
            />
          </div>
          <FinanceFieldsInputs values={finance} onChange={setFinance} />
          {(doc.amountHistory?.length ?? 0) > 1 && (
            <div>
              <p className="label">היסטוריית עדכוני סכום</p>
              <div className="space-y-1 text-sm">
                {[...(doc.amountHistory || [])]
                  .reverse()
                  .slice(0, 10)
                  .map((h, i) => (
                    <div key={i} className="flex justify-between text-slate-600">
                      <span>{formatDateTime(h.at)}</span>
                      <span className="font-medium">{formatCurrency(h.amount)}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {isFinancial && (
        <div className="card p-5">
          <label className="label">תשלום חודשי חוזר</label>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-600 mb-2">
            <input
              type="checkbox"
              checked={isMonthlyPayment}
              onChange={(e) => setIsMonthlyPayment(e.target.checked)}
              className="rounded"
            />
            זו הוצאה/הכנסה חוזרת מדי חודש (ולא חד-פעמית)
          </label>
          {isMonthlyPayment && (
            <input
              type="number"
              step="0.01"
              className="input"
              placeholder="סכום חודשי (₪)"
              value={monthlyAmount}
              onChange={(e) => setMonthlyAmount(e.target.value)}
            />
          )}
        </div>
      )}

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
