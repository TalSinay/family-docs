"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"credentials" | "otp">("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
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

  return (
    <div className="w-full max-w-sm">
      <div className="text-center mb-8">
        <div className="text-4xl mb-2">🔐</div>
        <h1 className="text-2xl font-bold text-teal-800">אזור ניהול</h1>
        <p className="text-slate-500 text-sm mt-1">
          {step === "credentials" ? "כניסת מנהל" : "הזן את הקוד שנשלח למייל שלך"}
        </p>
      </div>

      {step === "credentials" ? (
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
        </form>
      ) : (
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
    </div>
  );
}
