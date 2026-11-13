"use client";

import { useEffect, useState } from "react";

/**
 * "Agora" que se renova a cada `intervalMs` (padrão 30 s) e ao voltar para a aba, para tempos relativos
 * ("há 3 min") não envelhecerem. Sem timer enquanto a aba está oculta. `intervalMs <= 0` desliga timer e
 * listeners (quem já recebe um relógio por prop não paga um timer por linha). [produto-telas §4 SignalTime]
 */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!(intervalMs > 0)) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const tick = () => setNow(new Date());
    const start = () => { if (timer === undefined) timer = setInterval(tick, intervalMs); };
    const stop = () => { if (timer !== undefined) { clearInterval(timer); timer = undefined; } };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") stop();
      else { tick(); start(); }
    };
    if (document.visibilityState !== "hidden") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => { stop(); document.removeEventListener("visibilitychange", onVisibility); };
  }, [intervalMs]);
  return now;
}
