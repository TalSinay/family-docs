import { Resend } from "resend";

// שליחת מייל עם קוד האימות הדו-שלבי לכניסה לאזור הניהול.
// דורש משתני סביבה: RESEND_API_KEY, ADMIN_OTP_FROM_EMAIL (כתובת שולח מאומתת ב-Resend).
export async function sendAdminOtpEmail(toEmail: string, code: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ADMIN_OTP_FROM_EMAIL;

  if (!apiKey || !from) {
    throw new Error(
      "חסרים משתני סביבה RESEND_API_KEY / ADMIN_OTP_FROM_EMAIL - נדרשים לשליחת קוד אימות"
    );
  }

  const resend = new Resend(apiKey);

  const { error } = await resend.emails.send({
    from,
    to: toEmail,
    subject: "קוד אימות לכניסה לאזור הניהול",
    html: `
      <div style="font-family: sans-serif; direction: rtl; text-align: right;">
        <p>קוד האימות שלך לכניסה לאזור הניהול של תיק המשפחה:</p>
        <p style="font-size: 28px; font-weight: bold; letter-spacing: 4px;">${code}</p>
        <p style="color: #64748b; font-size: 13px;">הקוד בתוקף ל-10 דקות. אם לא ביקשת קוד זה, אפשר להתעלם מהמייל.</p>
      </div>
    `,
  });

  if (error) {
    throw new Error(`שליחת מייל האימות נכשלה: ${error.message}`);
  }
}

export function generateOtpCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}
