import { cookies } from "next/headers";
import { IS_PROD } from "./env";

export const AT = "sdt_at"; // access token — httpOnly
export const RT = "sdt_rt"; // refresh token — httpOnly
export const CSRF = "sdt_csrf"; // token CSRF — legível por JS (double-submit)

export async function setSession(accessToken: string, refreshToken: string): Promise<void> {
  const c = await cookies();
  c.set(AT, accessToken, { httpOnly: true, secure: IS_PROD, sameSite: "lax", path: "/", maxAge: 15 * 60 });
  c.set(RT, refreshToken, { httpOnly: true, secure: IS_PROD, sameSite: "strict", path: "/", maxAge: 7 * 24 * 3600 });
  // Preserve the double-submit value while renewing its lifetime with the session.
  const csrf = c.get(CSRF)?.value;
  if (csrf) await setCsrf(csrf);
}

export async function setCsrf(token: string): Promise<void> {
  const c = await cookies();
  c.set(CSRF, token, { httpOnly: false, secure: IS_PROD, sameSite: "strict", path: "/", maxAge: 7 * 24 * 3600 });
}

export async function clearSession(): Promise<void> {
  const c = await cookies();
  c.delete(AT);
  c.delete(RT);
  c.delete(CSRF);
}

export async function getAccess(): Promise<string | undefined> {
  return (await cookies()).get(AT)?.value;
}
export async function getRefresh(): Promise<string | undefined> {
  return (await cookies()).get(RT)?.value;
}
export async function getCsrfCookie(): Promise<string | undefined> {
  return (await cookies()).get(CSRF)?.value;
}
