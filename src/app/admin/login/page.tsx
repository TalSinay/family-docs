"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

type Step = "credentials" | "otp" | "forgot-request" | "forgot-reset";

export default function AdminLoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "שגיאה");
      setStep("otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה לא צפויה");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await signIn("admin-credentials", { email, password, otp, redirect: false });
    setLoading(false);
    if (res?.error) {
      setError("קוד האימות שגוי או שפג תוקפו");
      return;
    }
    router.push("/admin");
    router.refresh();
  }

  async function handleForgotRequest(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "שגיאה");
      setStep("forgot-reset");
      setInfo("אם קיים משתמש admin עם האימייל הזה, נשלח אליו קוד לאיפוס סיסמה.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה לא צפויה");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotReset(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    if (newPassword !== newPasswordConfirm) {
      setError("הסיסמאות אינן תואמות");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: resetCode, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "שגיאה");

      // איפוס הצליח - חוזרים למסך הכניסה הרגיל עם הסיסמה החדשה (עדיין נדרש OTP לכניסה בפועל)
      setPassword("");
      setResetCode("");
      setNewPassword("");
      setNewPasswordConfirm("");
      setStep("credentials");
      setInfo("הסיסמה עודכנה בהצלחה. אפשר להתחבר איתה עכשיו.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה לא צפויה");
    } finally {
      setLoading(false);
    }
  }

  const titles: Record<Step, string> = {
    credentials: "כניסת מנהל",
    otp: "הזן את הקוד שנשלח למייל שלך",
    "forgot-request": "איפוס סיסמה",
    "forgot-reset": "קביעת סיסמה חדשה",
  };

  return (
    <div className="w-full max-w-sm">
      <div className="text-center mb-8">
        <div className="text-4xl mb-2">🔐</div>
        <h1 className="text-2xl font-bold text-teal-800">אזור ניהול</h1>
        <p className="text-slate-500 text-sm mt-1">{titles[step]}</p>
      </div>

      {info && (
        <div className="bg-teal-50 text-teal-700 text-sm rounded-xl px-3 py-2 mb-4">{info}</div>
      )}

      {step === "credentials" && (
        <form onSubmit={handleRequestOtp} className="card p-6 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-700 text-sm rounded-xl px-3 py-2">{error}</div>
          )}
          <div>
            <label className="label">אימייל</label>
            <input
              type="email"
              required
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="label">סיסמה</label>
            <input
              type="password"
              required
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "שולח קוד..." : "שלח קוד אימות"}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep("forgot-request");
              setError("");
              setInfo("");
            }}
            className="text-sm text-teal-700 w-full text-center"
          >
            שכחתי סיסמה
          </button>
        </form>
      )}

      {step === "otp" && (
        <form onSubmit={handleVerifyOtp} className="card p-6 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-700 text-sm rounded-xl px-3 py-2">{error}</div>
          )}
          <div>
            <label className="label">קוד אימות (6 ספרות)</label>
            <input
              inputMode="numeric"
              autoFocus
              required
              className="input text-center tracking-widest text-lg"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              maxLength={6}
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "מאמת..." : "כניסה"}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep("credentials");
              setOtp("");
              setError("");
            }}
            className="text-sm text-slate-500 w-full text-center"
          >
            חזרה
          </button>
        </form>
      )}

      {step === "forgot-request" && (
        <form onSubmit={handleForgotRequest} className="card p-6 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-700 text-sm rounded-xl px-3 py-2">{error}</div>
          )}
          <p className="text-sm text-slate-500">
            נזין את האימייל של חשבון ה-admin, ונשלח אליו קוד לקביעת סיסמה חדשה.
          </p>
          <div>
            <label className="label">אימייל</label>
            <input
              type="email"
              required
              autoFocus
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "שולח..." : "שלח קוד איפוס"}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep("credentials");
              setError("");
              setInfo("");
            }}
            className="text-sm text-slate-500 w-full text-center"
          >
            חזרה לכניסה
          </button>
        </form>
      )}

      {step === "forgot-reset" && (
        <form onSubmit={handleForgotReset} className="card p-6 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-700 text-sm rounded-xl px-3 py-2">{error}</div>
          )}
          <div>
            <label className="label">קוד איפוס (מהמייל)</label>
            <input
              inputMode="numeric"
              autoFocus
              required
              className="input text-center tracking-widest text-lg"
              value={resetCode}
              onChange={(e) => setResetCode(e.target.value)}
              maxLength={6}
            />
          </div>
          <div>
            <label className="label">סיסמה חדשה (6 תווים לפחות)</label>
            <input
              type="password"
              required
              minLength={6}
              className="input"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div>
            <label className="label">אימות סיסמה חדשה</label>
            <input
              type="password"
              required
              minLength={6}
              className="input"
              value={newPasswordConfirm}
              onChange={(e) => setNewPasswordConfirm(e.target.value)}
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "מעדכן..." : "קביעת סיסמה חדשה"}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep("forgot-request");
              setResetCode("");
              setNewPassword("");
              setNewPasswordConfirm("");
              setError("");
              setInfo("");
            }}
            className="text-sm text-slate-500 w-full text-center"
          >
            לא קיבלתי קוד / שלח שוב
          </button>
        </form>
      )}
    </div>
  );
}
