import { NextResponse } from "next/server";
import { callApi } from "@/lib/server/api";
import { getAccess, clearSession } from "@/lib/server/session";
import { assertCsrf } from "@/lib/server/csrf";

/** Troca de senha (logado). Sucesso invalida os tokens no backend → limpa a sessão (re-login). */
export async function POST(req: Request) {
  if (!(await assertCsrf(req))) {
    return NextResponse.json({ error: { code: "CSRF", message: "Requisição inválida" } }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const access = await getAccess();
  const res = await callApi("POST", "/auth/change-password", { body, accessToken: access });
  if (res.status === 200) {
    await clearSession();
  }
  return NextResponse.json(res.data ?? { ok: res.status === 200 }, { status: res.status });
}
