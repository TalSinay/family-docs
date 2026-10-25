"use client";

import { useEffect, useState } from "react";

const HORIZON_DAYS = 90;

function daysUntil(dueDate: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dueDate);
  if (!m) return null;
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) - today) / 86400000);
}

// טבעת ספירה לאחור לתאריך יעד: ככל שקרוב יותר הטבעת מלאה יותר וצבעה עובר מירוק לכתום ולאדום.
// מוצגת רק כשהתאריך בטווח של 90 יום (או שעבר). נקבעת אחרי עליית הרכיב כדי להתאים לשעון המכשיר.
export function DueRing({ dueDate }: { dueDate?: string }) {
  const [days, setDays] = useState<number | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- חישוב לפי שעון המכשיר רק אחרי עליית הרכיב
    if (dueDate) setDays(daysUntil(dueDate));
  }, [dueDate]);

  if (days === null || days > HORIZON_DAYS) return null;
  const overdue = days < 0;
  const progress = overdue ? 100 : Math.max(6, Math.round(100 * (1 - days / HORIZON_DAYS)));
  const color = overdue || days <= 7 ? "#dc2626" : days <= 30 ? "#f59e0b" : "#4f46e5";
  return (
    <span className="shrink-0" title={overdue ? `עבר לפני ${-days} ימים` : `בעוד ${days} ימים`}>
      <svg width="42" height="42" viewBox="0 0 42 42">
        <circle cx="21" cy="21" r="16" fill="none" stroke="#e2e8f0" strokeWidth="5" />
        <circle
          cx="21"
          cy="21"
          r="16"
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${progress} ${100 - progress}`}
          pathLength={100}
          transform="rotate(-90 21 21)"
        />
        <text x="21" y="25" textAnchor="middle" fontSize="11" fontWeight="700" fill="#0f172a">
          {overdue ? "!" : days}
        </text>
      </svg>
    </span>
  );
}
