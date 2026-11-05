"use client";

// שדות הקלט הייחודיים לרשומות "פיננסים" - משותפים לטופס ההעלאה ולעמוד הרשומה.
// הסכום עצמו מנוהל בכל טופס בנפרד (כבר קיים בשניהם).

export type FinanceFormValues = {
  platformName: string;
  expectedReturn: string;
  commissionFee: string;
  targetAmount: string;
  isLiability: boolean;
  loanStartDate: string;
  loanEndDate: string;
  loanMonthlyPayment: string;
  loanInterestRate: string;
};

export const EMPTY_FINANCE_VALUES: FinanceFormValues = {
  platformName: "",
  expectedReturn: "",
  commissionFee: "",
  targetAmount: "",
  isLiability: false,
  loanStartDate: "",
  loanEndDate: "",
  loanMonthlyPayment: "",
  loanInterestRate: "",
};

export function financeValuesToPayload(v: FinanceFormValues) {
  const num = (s: string) => (s.trim() === "" ? null : Number(s));
  return {
    platformName: v.platformName.trim(),
    expectedReturn: num(v.expectedReturn),
    commissionFee: num(v.commissionFee),
    targetAmount: num(v.targetAmount),
    isLiability: v.isLiability,
    loanStartDate: v.loanStartDate || null,
    loanEndDate: v.loanEndDate || null,
    loanMonthlyPayment: num(v.loanMonthlyPayment),
    loanInterestRate: num(v.loanInterestRate),
  };
}

export function FinanceFieldsInputs({
  values,
  onChange,
  showLoan = false,
}: {
  values: FinanceFormValues;
  onChange: (next: FinanceFormValues) => void;
  showLoan?: boolean;
}) {
  const set = <K extends keyof FinanceFormValues>(key: K, val: FinanceFormValues[K]) =>
    onChange({ ...values, [key]: val });

  return (
    <div className="space-y-3">
      <div>
        <label className="label">שם הפלטפורמה / הגוף</label>
        <input
          className="input"
          placeholder="לדוגמה: הפניקס, Bitcoin, בנק הפועלים"
          value={values.platformName}
          onChange={(e) => set("platformName", e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">רווח צפוי (%)</label>
          <input
            type="number"
            step="0.01"
            inputMode="decimal"
            className="input"
            value={values.expectedReturn}
            onChange={(e) => set("expectedReturn", e.target.value)}
          />
        </div>
        <div>
          <label className="label">עמלה (%)</label>
          <input
            type="number"
            step="0.01"
            inputMode="decimal"
            className="input"
            value={values.commissionFee}
            onChange={(e) => set("commissionFee", e.target.value)}
          />
        </div>
      </div>
      <div>
        <label className="label">סכום יעד (₪, אופציונלי)</label>
        <input
          type="number"
          step="0.01"
          inputMode="decimal"
          className="input"
          value={values.targetAmount}
          onChange={(e) => set("targetAmount", e.target.value)}
        />
      </div>
      {showLoan && (
        <div className="rounded-xl bg-slate-50 p-3 space-y-3">
          <p className="text-sm font-semibold">פרטי ההלוואה (הסכום למעלה = סכום ההלוואה המקורי)</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">תאריך ירידה ראשונה</label>
              <input type="date" className="input" value={values.loanStartDate} onChange={(e) => set("loanStartDate", e.target.value)} />
            </div>
            <div>
              <label className="label">תאריך סיום</label>
              <input type="date" className="input" min={values.loanStartDate} value={values.loanEndDate} onChange={(e) => set("loanEndDate", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">סכום שיורד כל חודש (₪)</label>
              <input type="number" step="0.01" inputMode="decimal" className="input" value={values.loanMonthlyPayment} onChange={(e) => set("loanMonthlyPayment", e.target.value)} />
            </div>
            <div>
              <label className="label">ריבית שנתית (%)</label>
              <input type="number" step="0.01" inputMode="decimal" className="input" value={values.loanInterestRate} onChange={(e) => set("loanInterestRate", e.target.value)} />
            </div>
          </div>
        </div>
      )}
      <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
        <input
          type="checkbox"
          checked={values.isLiability}
          onChange={(e) => set("isLiability", e.target.checked)}
          className="rounded"
        />
        זו התחייבות / חוב (מופחת מהסה&quot;כ)
      </label>
    </div>
  );
}
