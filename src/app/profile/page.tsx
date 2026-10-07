"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Save, KeyRound, Bell, BellOff, Plus, Trash2 } from "lucide-react";
import {
  isPushSupported,
  getPushSubscriptionStatus,
  enablePush,
  disablePush,
} from "@/lib/pushClient";

type MonthlyReminder = { _id: string; title: string; dayOfMonth: number; time?: string };

export default function ProfilePage() {
  const { update } = useSession();
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);

  const [nameError, setNameError] = useState("");
  const [nameSavedMsg, setNameSavedMsg] = useState("");
  const [savingName, setSavingName] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSavedMsg, setPasswordSavedMsg] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const [pushSupported, setPushSupported] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushError, setPushError] = useState("");

  const [reminders, setReminders] = useState<MonthlyReminder[]>([]);
  const [reminderTitle, setReminderTitle] = useState("");
  const [reminderDay, setReminderDay] = useState("1");
  const [reminderTime, setReminderTime] = useState("");
  const [defaultTime, setDefaultTime] = useState("09:00");
  const [addingReminder, setAddingReminder] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/profile");
      if (res.ok) {
        const data = await res.json();
        setName(data.name || "");
        setEmail(data.email || "");
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- בדיקת תמיכה/מצב מינוי במכשיר, לא לולאת render
    setPushSupported(isPushSupported());
    getPushSubscriptionStatus().then(setPushEnabled);
  }, []);

  const fetchReminders = useCallback(async () => {
    const [res, settingsRes] = await Promise.all([
      fetch("/api/monthly-reminders"),
      fetch("/api/notification-settings"),
    ]);
    if (res.ok) setReminders(await res.json());
    if (settingsRes.ok) setDefaultTime((await settingsRes.json()).notificationTime);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- טעינת תזכורות בעלייה, לא לולאת render
    fetchReminders();
  }, [fetchReminders]);

  async function togglePush() {
    setPushError("");
    setPushLoading(true);
    try {
      if (pushEnabled) {
        await disablePush();
        setPushEnabled(false);
      } else {
        const res = await enablePush();
        if (!res.ok) setPushError(res.error || "שגיאה בהפעלת התראות");
        else setPushEnabled(true);
      }
    } finally {
      setPushLoading(false);
    }
  }

  async function addReminder(e: React.FormEvent) {
    e.preventDefault();
    if (!reminderTitle.trim()) return;
    setAddingReminder(true);
    try {
      const res = await fetch("/api/monthly-reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: reminderTitle.trim(),
          dayOfMonth: Number(reminderDay),
          time: reminderTime || undefined,
        }),
      });
      if (res.ok) {
        setReminderTitle("");
        setReminderDay("1");
        setReminderTime("");
        fetchReminders();
      }
    } finally {
      setAddingReminder(false);
    }
  }

  async function deleteReminder(id: string) {
    setReminders((prev) => prev.filter((r) => r._id !== id));
    await fetch(`/api/monthly-reminders/${id}`, { method: "DELETE" });
  }

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setNameError("");
    setNameSavedMsg("");
    if (!name.trim()) {
      setNameError("חסר שם");
      return;
    }
    setSavingName(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNameError(data.error || "שגיאה");
        return;
      }
      // מרענן את ה-session כדי שהשם החדש יופיע מיד בכל מקום באפליקציה (כותרת, הועלה ע"י וכו')
      await update({ name: data.name });
      router.refresh();
      setNameSavedMsg("נשמר");
      setTimeout(() => setNameSavedMsg(""), 2000);
    } finally {
      setSavingName(false);
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError("");
    setPasswordSavedMsg("");
    if (!currentPassword || !newPassword) {
      setPasswordError("חסרים פרטים");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("הסיסמה החדשה חייבת להכיל לפחות 6 תווים");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("אימות הסיסמה אינו תואם");
      return;
    }
    setSavingPassword(true);
    try {
      const res = await fetch("/api/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPasswordError(data.error || "שגיאה");
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSavedMsg("הסיסמה עודכנה בהצלחה");
      setTimeout(() => setPasswordSavedMsg(""), 3000);
    } finally {
      setSavingPassword(false);
    }
  }

  if (loading) return <p className="text-slate-500">טוען...</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">👤 אזור אישי</h1>

      <section className="card p-5 space-y-3">
        <h2 className="font-bold text-lg">פרטים אישיים</h2>
        <form onSubmit={saveName} className="space-y-3">
          <div>
            <label className="label">אימייל</label>
            <input className="input" value={email} disabled readOnly />
            <p className="text-xs text-slate-400 mt-1">לא ניתן לשנות אימייל עצמאית - פנה ל-admin.</p>
          </div>
          <div>
            <label className="label">שם</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          {nameError && <p className="text-sm text-red-600">{nameError}</p>}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={savingName}
              className="btn-primary flex items-center gap-1 disabled:opacity-60"
            >
              <Save size={16} /> שמירה
            </button>
            {nameSavedMsg && <span className="text-sm text-emerald-600">{nameSavedMsg}</span>}
          </div>
        </form>
      </section>

      <section className="card p-5 space-y-3">
        <h2 className="font-bold text-lg">החלפת סיסמה</h2>
        <form onSubmit={savePassword} className="space-y-3">
          <div>
            <label className="label">סיסמה נוכחית</label>
            <input
              type="password"
              className="input"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className="label">סיסמה חדשה</label>
            <input
              type="password"
              className="input"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="label">אימות סיסמה חדשה</label>
            <input
              type="password"
              className="input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          {passwordError && <p className="text-sm text-red-600">{passwordError}</p>}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={savingPassword}
              className="btn-secondary flex items-center gap-1 disabled:opacity-60"
            >
              <KeyRound size={16} /> עדכון סיסמה
            </button>
            {passwordSavedMsg && <span className="text-sm text-emerald-600">{passwordSavedMsg}</span>}
          </div>
        </form>
      </section>

      <section className="card p-5 space-y-3">
        <h2 className="font-bold text-lg">התראות</h2>
        {!pushSupported ? (
          <p className="text-sm text-slate-400">הדפדפן/המכשיר הזה לא תומך בהתראות push.</p>
        ) : (
          <>
            <p className="text-sm text-slate-500">
              קבלת התראה למכשיר הזה על משימות שהגיע/עבר תאריך היעד שלהן, מסמכים עם תאריך יעד
              מתקרב, ותזכורות חודשיות (למטה).
            </p>
            {pushError && <p className="text-sm text-red-600">{pushError}</p>}
            <button
              onClick={togglePush}
              disabled={pushLoading}
              className={`flex items-center gap-2 disabled:opacity-60 ${
                pushEnabled ? "btn-secondary" : "btn-primary"
              }`}
            >
              {pushEnabled ? <BellOff size={16} /> : <Bell size={16} />}
              {pushLoading ? "מעבד..." : pushEnabled ? "כיבוי התראות במכשיר זה" : "הפעלת התראות במכשיר זה"}
            </button>
          </>
        )}
      </section>

      <section className="card p-5 space-y-3">
        <h2 className="font-bold text-lg">תזכורות חודשיות חוזרות</h2>
        <p className="text-sm text-slate-500">
          תזכורת שתישלח בכל חודש, ביום הנבחר, לכל חברי ה-workspace שהפעילו התראות (למשל
          &quot;להעלות תלוש שכר&quot;).
        </p>

        <div className="space-y-1.5">
          {reminders.length === 0 && (
            <p className="text-sm text-slate-400">אין תזכורות חודשיות עדיין.</p>
          )}
          {reminders.map((r) => (
            <div key={r._id} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
              <span className="text-xs font-semibold text-teal-700 bg-teal-50 rounded-full px-2 py-0.5 shrink-0 text-center leading-tight">
                {r.dayOfMonth} לחודש
                <br />
                {r.time || defaultTime}
              </span>
              <span className="text-sm flex-1 break-words">{r.title}</span>
              <button
                onClick={() => deleteReminder(r._id)}
                className="shrink-0 text-slate-400 hover:text-red-600"
                aria-label="מחיקת תזכורת"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>

        <form onSubmit={addReminder} className="space-y-3 border-t border-slate-100 pt-3">
          <div>
            <label className="label">מה להזכיר?</label>
            <textarea
              className="input min-h-[72px]"
              placeholder="לדוגמה: להעלות תלוש שכר - דניאל"
              value={reminderTitle}
              onChange={(e) => setReminderTitle(e.target.value)}
            />
          </div>
          <div className="flex gap-3">
            <div className="w-24">
              <label className="label">יום בחודש</label>
              <input
                type="number"
                min="1"
                max="28"
                className="input text-center"
                value={reminderDay}
                onChange={(e) => setReminderDay(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <label className="label">שעה</label>
              <input
                type="time"
                className="input"
                value={reminderTime}
                onChange={(e) => setReminderTime(e.target.value)}
              />
              <p className="text-xs text-slate-400 mt-1">
                ריק = שעת ברירת המחדל ({defaultTime})
              </p>
            </div>
          </div>
          {reminderTitle.trim() && (
            <p className="text-sm text-slate-600 bg-teal-50 rounded-lg px-3 py-2">
              תישלח ב-{Number(reminderDay) || 1} לכל חודש בשעה {reminderTime || defaultTime}:{" "}
              <span className="font-medium">{reminderTitle.trim()}</span>
            </p>
          )}
          <button
            type="submit"
            disabled={addingReminder || !reminderTitle.trim()}
            className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <Plus size={16} /> {addingReminder ? "מוסיף..." : "הוספת תזכורת"}
          </button>
        </form>
      </section>
    </div>
  );
}
