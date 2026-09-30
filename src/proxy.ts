import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const AUTH_PAGES = ["/login"];

export const proxy = auth((req) => {
  const isLoggedIn = !!req.auth;
  const isAdmin = !!req.auth?.user?.isAdmin;
  const { pathname } = req.nextUrl;
  const isAuthPage = AUTH_PAGES.includes(pathname);
  const isAdminLoginPage = pathname === "/admin/login";
  const isAdminArea = pathname.startsWith("/admin") && !isAdminLoginPage;

  // אזור הניהול: דורש session עם isAdmin (שמתקבל רק אחרי כניסה מלאה, כולל OTP,
  // דרך /admin/login). מי שאינו admin מנותב לדף הכניסה הרגיל של האזור.
  if (isAdminArea && !isAdmin) {
    const adminLoginUrl = new URL("/admin/login", req.nextUrl.origin);
    return NextResponse.redirect(adminLoginUrl);
  }

  if (isAdminLoginPage && isAdmin) {
    const adminUrl = new URL("/admin", req.nextUrl.origin);
    return NextResponse.redirect(adminUrl);
  }

  if (!isLoggedIn && !isAuthPage && !isAdminLoginPage) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    return NextResponse.redirect(loginUrl);
  }

  if (isLoggedIn && isAuthPage) {
    const dashboardUrl = new URL("/dashboard", req.nextUrl.origin);
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
});

export const config = {
  // כל עמוד מוגן (חוץ מ-login/admin-login עצמם), אבל לא API - שם כל route בודק auth() בעצמו
  matcher: [
    "/((?!api|_next/static|_next/image|manifest.json|sw.js|icons|favicon.ico).*)",
  ],
};
