import { API_URL, requireInternalSecret } from "./env";
import { signInternalRequest, signInternalRequestV2 } from "./hmac";

export interface ApiResult {
  status: number;
  data: unknown;
}

export interface CallOpts {
  body?: unknown;
  accessToken?: string;
  extraHeaders?: Record<string, string>;
}

/** Chamada assinada à API Fastify. O navegador nunca faz isso — só o BFF. */
export async function callApi(method: string, path: string, opts: CallOpts = {}): Promise<ApiResult> {
  const payload = opts.body !== undefined ? JSON.stringify(opts.body) : "";
  const ts = Date.now();
  const secret = requireInternalSecret();
  const pathNoQuery = path.split("?")[0]; // v2 amarra o path SEM query
  const headers: Record<string, string> = {
    "x-internal-timestamp": String(ts),
    "x-internal-signature": signInternalRequest(secret, payload, ts),
    // T5 Fase 1: assinatura nova enviada EM PARALELO só pra medir divergência no backend (não autentica ainda).
    "x-internal-sig-v2": signInternalRequestV2(secret, { method, path: pathNoQuery, body: payload, timestamp: ts }),
    ...(opts.extraHeaders ?? {}),
  };
  if (opts.accessToken) headers.authorization = `Bearer ${opts.accessToken}`;
  if (opts.body !== undefined) headers["content-type"] = "application/json";

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: opts.body !== undefined ? payload : undefined,
    cache: "no-store",
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}
