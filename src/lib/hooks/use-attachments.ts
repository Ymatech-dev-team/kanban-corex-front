import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";

export interface Attachment {
  id: string;
  taskId: string;
  fileName: string;
  contentType: string;
  size: number;
  uploaderName: string;
  createdAt: string; // ISO
  canRemove: boolean;
}

export function attachmentsKey(taskId: string | null) {
  return ["attachments", taskId] as const;
}

export function useAttachments(taskId: string) {
  return useQuery<Attachment[]>({
    queryKey: attachmentsKey(taskId),
    queryFn: async () =>
      (await api.get<{ attachments: Attachment[] }>(`/tasks/${taskId}/attachments`)).data.attachments,
    staleTime: 30_000,
  });
}

/** PUT do binário DIRETO no Blob pela URL assinada. XHR (não fetch) pra ter progresso de upload. */
function putToBlob(
  uploadUrl: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<{ url: string; pathname: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl, true);
    xhr.setRequestHeader("x-content-type", file.type); // tipo real (o Blob rejeita fora da allowlist assinada)
    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          reject(new Error("Resposta inválida do armazenamento"));
        }
      } else {
        reject(new Error(`Falha no upload (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error("Falha de rede no upload"));
    xhr.send(file);
  });
}

/**
 * Sobe UM arquivo: 1) pede ao backend uma URL de PUT assinada (o backend valida o acesso ao cliente da
 * tarefa e gera o pathname), 2) o browser sobe DIRETO pro Blob privado via XHR (barra de progresso),
 * 3) confirma no backend, que revalida tamanho/tipo REAIS via head() e grava. Download só pelo endpoint
 * que assina — o binário nunca é público. [anexos B]
 */
export async function uploadTaskAttachment(taskId: string, file: File, onProgress?: (pct: number) => void) {
  const { uploadUrl } = (
    await api.post<{ uploadUrl: string; pathname: string }>(`/tasks/${taskId}/attachments/upload-token`, {
      fileName: file.name,
      contentType: file.type,
      size: file.size,
    })
  ).data;
  const blob = await putToBlob(uploadUrl, file, onProgress);
  await api.post(`/tasks/${taskId}/attachments`, { url: blob.url, pathname: blob.pathname, fileName: file.name });
}

/**
 * URL de download ASSINADA de curta duração pro anexo — o backend só assina após o gate de acesso ao
 * cliente da tarefa. Serve tanto pra exibir imagem inline (<img src>) quanto pra abrir/baixar. [anexos B]
 */
export async function fetchAttachmentUrl(taskId: string, attachmentId: string): Promise<string> {
  return (await api.get<{ url: string }>(`/tasks/${taskId}/attachments/${attachmentId}/download`)).data.url;
}

/**
 * Abre um anexo numa aba nova (baixar/visualizar fora do site). A aba é aberta SÍNCRONA (dentro do gesto
 * do clique) — se abríssemos depois do await, o popup blocker do iOS/Safari/PWA barraria em silêncio.
 * `w.opener = null` corta o window.opener (anti-tabnabbing), já que não dá pra usar `noopener` e ainda
 * manter o handle pra detectar bloqueio. [painel]
 */
export async function downloadAttachment(taskId: string, attachmentId: string) {
  const w = typeof window !== "undefined" ? window.open("", "_blank") : null;
  if (w) w.opener = null;
  try {
    const url = await fetchAttachmentUrl(taskId, attachmentId);
    if (!w) throw new Error("popup-bloqueado");
    w.location.href = url;
  } catch (e) {
    w?.close();
    throw e;
  }
}

export function useDeleteAttachment(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/tasks/${taskId}/attachments/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: attachmentsKey(taskId) }),
    onError: () => toast.error("Não foi possível remover o anexo"),
  });
}
