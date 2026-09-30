import { Resend } from "resend";

function getClient() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ADMIN_OTP_FROM_EMAIL;

  if (!apiKey || !from) {
    throw new Error(
      "חסרים משתני סביבה RESEND_API_KEY / ADMIN_OTP_FROM_EMAIL - נדרשים לשליחת קוד אימות"
    );
  }

  return { resend: new Resend(apiKey), from };
}

// שליחת מייל עם קוד האימות הדו-שלבי לכניסה לאזור הניהול.
export async function sendAdminOtpEmail(toEmail: string, code: string) {
  const { resend, from } = getClient();

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

// שליחת מייל עם קוד לאיפוס סיסמת ה-admin ("שכחתי סיסמה").
export async function sendAdminPasswordResetEmail(toEmail: string, code: string) {
  const { resend, from } = getClient();

  const { error } = await resend.emails.send({
    from,
    to: toEmail,
    subject: "קוד לאיפוס סיסמה - אזור הניהול",
    html: `
      <div style="font-family: sans-serif; direction: rtl; text-align: right;">
        <p>קיבלנו בקשה לאיפוס הסיסמה שלך לאזור הניהול של תיק המשפחה. הקוד לאיפוס:</p>
        <p style="font-size: 28px; font-weight: bold; letter-spacing: 4px;">${code}</p>
        <p style="color: #64748b; font-size: 13px;">הקוד בתוקף ל-15 דקות. אם לא ביקשת איפוס סיסמה, אפשר להתעלם מהמייל - הסיסמה הנוכחית שלך תישאר תקפה.</p>
      </div>
    `,
  });

  if (error) {
    throw new Error(`שליחת מייל איפוס הסיסמה נכשלה: ${error.message}`);
  }
}

export function generateOtpCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}
