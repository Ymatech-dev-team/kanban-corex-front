import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { callApi } from "@/lib/server/api";
import { setSession, setCsrf } from "@/lib/server/session";

/** Login: chama a API, guarda os tokens em cookie httpOnly, gera o token CSRF. */
export async function POST(req: Request) {
  // Só JSON — barra form cross-site (login-CSRF). [SEC-004]
  if (!(req.headers.get("content-type") ?? "").includes("application/json")) {
    return NextResponse.json({ error: { code: "VALIDACAO", message: "Formato inválido" } }, { status: 400 });
  }
  const body = await req.json().catch(() => null);
  const res = await callApi("POST", "/auth/login", { body });
  if (res.status !== 200) {
    return NextResponse.json(res.data ?? { error: { code: "ERRO", message: "Falha no login" } }, {
      status: res.status,
    });
  }
  const d = res.data as { accessToken: string; refreshToken: string; mustChangePassword: boolean };
  await setSession(d.accessToken, d.refreshToken);
  await setCsrf(randomBytes(24).toString("base64url"));
  // Nunca devolve os tokens ao navegador — só o que a UI precisa.
  return NextResponse.json({ mustChangePassword: d.mustChangePassword });
}
