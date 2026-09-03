import { NextResponse } from "next/server";
import { callApi } from "@/lib/server/api";
import { getRefresh, clearSession } from "@/lib/server/session";
import { assertCsrf } from "@/lib/server/csrf";

export async function POST(req: Request) {
  if (!(await assertCsrf(req))) {
    return NextResponse.json({ error: { code: "CSRF", message: "Requisição inválida" } }, { status: 403 });
  }
  const rt = await getRefresh();
  if (rt) await callApi("POST", "/auth/logout", { body: { refreshToken: rt } });
  await clearSession();
  return NextResponse.json({ ok: true });
}
