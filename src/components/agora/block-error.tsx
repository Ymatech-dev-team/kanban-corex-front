"use client";

import { Alert } from "@heroui/react";
import { Button } from "@/components/ui/button";

/** Erro isolado por bloco (RF17): mensagem + "Tentar novamente", sem derrubar o resto da tela. */
export function BlockError({ message, onRetry, retrying = false }: { message: string; onRetry: () => void; retrying?: boolean }) {
  return (
    <Alert status="danger" role="alert" className="mt-2">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{message}</Alert.Title>
      </Alert.Content>
      <Button type="button" variant="outline" size="sm" className="max-md:h-11" disabled={retrying} onClick={onRetry}>Tentar novamente</Button>
    </Alert>
  );
}
