import { NextRequest, NextResponse } from "next/server";
import { callApi } from "@/lib/server/api";
import { getAccess, getRefresh, setSession, clearSession } from "@/lib/server/session";
import { assertCsrf } from "@/lib/server/csrf";
import { refreshSession } from "@/lib/server/refresh";

// Só proxia rotas de domínio — /auth/* e /internal/* NÃO passam por aqui. [SEC]
const ALLOWED = new Set(["me", "projects", "tasks", "subtasks", "members", "roles"]);
const MUTATIONS = new Set(["POST", "PATCH", "DELETE"]);
// Charset seguro por segmento (cuid/kebab) — bloqueia `..`, `.`, `/`, `%2e` etc. [SEC-001]
const SAFE_SEGMENT = /^[A-Za-z0-9_-]+$/;

async function handle(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  // 1º segmento na allowlist E todos os segmentos no charset seguro (anti path-traversal).
  if (path.length === 0 || !ALLOWED.has(path[0]) || !path.every((s) => SAFE_SEGMENT.test(s))) {
    return NextResponse.json({ error: { code: "NAO_ENCONTRADO", message: "Recurso não encontrado" } }, { status: 404 });
  }

  const method = req.method;
  if (MUTATIONS.has(method) && !(await assertCsrf(req))) {
    return NextResponse.json({ error: { code: "CSRF", message: "Requisição inválida" } }, { status: 403 });
  }

  const target = "/" + path.join("/") + (req.nextUrl.search || "");
  const body = method === "POST" || method === "PATCH" ? await req.json().catch(() => undefined) : undefined;

  // Headers repassados só se no formato esperado. [SEC-005]
  const extraHeaders: Record<string, string> = {};
  const idem = req.headers.get("idempotency-key");
  if (idem && /^[A-Za-z0-9_-]{1,128}$/.test(idem)) extraHeaders["idempotency-key"] = idem;
  const ius = req.headers.get("if-unmodified-since");
  if (ius && !Number.isNaN(Date.parse(ius))) extraHeaders["if-unmodified-since"] = ius;

  const access = await getAccess();
  let res = await callApi(method, target, { body, accessToken: access, extraHeaders });

  // 401 → tenta refresh (single-flight) e refaz a chamada. [design.md §5]
  if (res.status === 401) {
    const rt = await getRefresh();
    if (rt) {
      const refreshed = await refreshSession(rt);
      if (refreshed.status === 200) {
        const d = refreshed.data as { accessToken: string; refreshToken: string };
        await setSession(d.accessToken, d.refreshToken);
        res = await callApi(method, target, { body, accessToken: d.accessToken, extraHeaders });
      } else {
        await clearSession();
      }
    }
  }

  return NextResponse.json(res.data, { status: res.status });
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const DELETE = handle;
