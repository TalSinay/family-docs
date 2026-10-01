"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Save, KeyRound } from "lucide-react";

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
    </div>
  );
}
