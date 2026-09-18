/**
 * Relay EM MEMÓRIA da senha temporária entre login → first-login (pré-preenche o "senha atual").
 * Não usa sessionStorage/localStorage — sobrevive só à navegação client-side (SPA); num refresh/hard-nav
 * some, e a pessoa redigita (mesmo fallback de antes). Tirar senha do storage do browser. [hardening T6]
 */
let tempPassword: string | null = null;

export function setTempPassword(pw: string): void {
  tempPassword = pw;
}

/** Lê e LIMPA (uso único) — a senha não fica guardada além do necessário. */
export function takeTempPassword(): string {
  const v = tempPassword ?? "";
  tempPassword = null;
  return v;
}
