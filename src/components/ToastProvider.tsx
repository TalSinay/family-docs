"use client";

import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";

export type ToastInput = {
  title: string;
  detail?: string;
  href?: string; // קישור "פתח"
  hrefLabel?: string;
  undo?: () => Promise<void> | void; // ביטול הפעולה
};

type ToastState = ToastInput & { id: number };

const ToastContext = createContext<{ show: (t: ToastInput) => void }>({ show: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

const DURATION_MS = 8000;

// הודעה קצרה בתחתית המסך אחרי פעולה, עם "בטל" (אם אפשר) - במקום חלון נוסף.
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => setToast(null), []);

  const show = useCallback((t: ToastInput) => {
    if (timer.current) clearTimeout(timer.current);
    setBusy(false);
    setToast({ ...t, id: Date.now() });
    timer.current = setTimeout(() => setToast(null), DURATION_MS);
  }, []);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function onUndo() {
    if (!toast?.undo) return;
    setBusy(true);
    try {
      await toast.undo();
    } finally {
      setToast(null);
    }
  }

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast && (
        <div
          role="status"
          className="fixed inset-x-3 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-[60] mx-auto max-w-md rounded-2xl bg-slate-900 text-white shadow-2xl shadow-slate-900/30 px-4 py-3 flex items-center gap-3"
        >
          <span className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
            <Check size={16} strokeWidth={3} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm truncate">{toast.title}</p>
            {toast.detail && <p className="text-xs text-white/70 truncate">{toast.detail}</p>}
          </div>
          {toast.href && (
            <Link href={toast.href} onClick={dismiss} className="text-sm font-bold text-indigo-300 shrink-0">
              {toast.hrefLabel ?? "פתח"}
            </Link>
          )}
          {toast.undo && (
            <button onClick={onUndo} disabled={busy} className="text-sm font-bold text-indigo-300 shrink-0 disabled:opacity-50">
              בטל
            </button>
          )}
        </div>
      )}
    </ToastContext.Provider>
  );
}
