"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, X, Loader2, FileText, FileArchive, FileImage, Paperclip } from "lucide-react";
import { toast } from "sonner";
import {
  useAttachments,
  useDeleteAttachment,
  uploadTaskAttachment,
  downloadAttachment,
  fetchAttachmentUrl,
  attachmentsKey,
  type Attachment,
} from "@/lib/hooks/use-attachments";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ALLOWED = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
]);
const MAX_BYTES = 15 * 1024 * 1024;

function fmtSize(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}
const isImage = (ct: string) => ct.startsWith("image/");

type Uploading = { key: string; name: string; pct: number };

export function AttachmentsSection({ taskId, disabled }: { taskId: string; disabled?: boolean }) {
  const qc = useQueryClient();
  const list = useAttachments(taskId);
  const del = useDeleteAttachment(taskId);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploads, setUploads] = useState<Uploading[]>([]);
  const [deleting, setDeleting] = useState<Attachment | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [viewing, setViewing] = useState<{ att: Attachment; url: string } | null>(null);

  async function onOpen(a: Attachment) {
    if (opening) return;
    setOpening(a.id);
    try {
      if (isImage(a.contentType)) {
        // imagem: abre no lightbox (inline no site) via URL assinada
        const url = await fetchAttachmentUrl(taskId, a.id);
        setViewing({ att: a, url });
      } else {
        // PDF/ZIP: abre/baixa em aba nova (não dá pra embutir sob o CSP)
        await downloadAttachment(taskId, a.id);
      }
    } catch (e) {
      const blocked = e instanceof Error && e.message === "popup-bloqueado";
      toast.error(blocked ? "Permita pop-ups para abrir o anexo" : `Não foi possível abrir "${a.fileName}"`);
    } finally {
      setOpening(null);
    }
  }

  async function onFiles(files: FileList | null) {
    if (!files) return;
    for (const file of Array.from(files)) {
      if (!ALLOWED.has(file.type)) {
        toast.error(`"${file.name}": tipo não permitido (só imagem, PDF ou ZIP)`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        toast.error(`"${file.name}": passa de 15 MB`);
        continue;
      }
      const key = `${file.name}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      setUploads((u) => [...u, { key, name: file.name, pct: 0 }]);
      try {
        await uploadTaskAttachment(taskId, file, (pct) =>
          setUploads((u) => u.map((x) => (x.key === key ? { ...x, pct } : x))),
        );
      } catch {
        toast.error(`Não foi possível enviar "${file.name}"`);
      } finally {
        setUploads((u) => u.filter((x) => x.key !== key));
        qc.invalidateQueries({ queryKey: attachmentsKey(taskId) });
      }
    }
  }

  const items = list.data ?? [];
  const isEmpty = items.length === 0 && uploads.length === 0;

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-3">
      <div className="flex items-center justify-between text-[13px]">
        <span className="font-medium">
          Anexos {items.length > 0 && <span className="font-normal text-muted-foreground">{items.length}</span>}
        </span>
      </div>

      <input
        ref={fileRef}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,application/zip,.zip"
        className="hidden"
        onChange={(e) => {
          onFiles(e.target.files);
          e.target.value = ""; // permite reenviar o mesmo arquivo
        }}
      />

      {isEmpty && disabled ? (
        <p className="text-[12.5px] text-muted-foreground">Nenhum anexo.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {items.map((a) => (
            <div key={a.id} className="group relative overflow-hidden rounded-xl border border-border bg-card">
              {!disabled && a.canRemove && (
                <button
                  type="button"
                  aria-label={`Remover ${a.fileName}`}
                  onClick={() => setDeleting(a)}
                  className="absolute right-1 top-1 z-10 flex size-6 items-center justify-center rounded-md bg-background/80 text-muted-foreground opacity-100 outline-none backdrop-blur transition hover:text-amber focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring lg:opacity-0 lg:group-hover:opacity-100"
                >
                  <X className="size-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => onOpen(a)}
                disabled={!!opening}
                aria-label={`Abrir ${a.fileName}`}
                className="block w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex h-[66px] items-center justify-center bg-popover text-muted-foreground">
                  {opening === a.id ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : isImage(a.contentType) ? (
                    <FileImage className="size-6" />
                  ) : a.contentType === "application/pdf" ? (
                    <FileText className="size-6" />
                  ) : (
                    <FileArchive className="size-6" />
                  )}
                </div>
                <div className="px-2 py-1.5">
                  <div className="truncate text-[11.5px] text-foreground" title={a.fileName}>
                    {a.fileName}
                  </div>
                  <div className="truncate text-[10px] text-muted-foreground">
                    {fmtSize(a.size)} · {a.uploaderName}
                  </div>
                </div>
              </button>
            </div>
          ))}

          {uploads.map((u) => (
            <div key={u.key} className="flex flex-col overflow-hidden rounded-xl border border-border bg-card">
              <div className="flex h-[66px] items-center justify-center bg-popover text-muted-foreground">
                <Loader2 className="size-5 animate-spin" />
              </div>
              <div className="px-2 py-1.5">
                <div className="truncate text-[11.5px] text-foreground" title={u.name}>
                  {u.name}
                </div>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-popover">
                  <div className="h-full bg-primary transition-all" style={{ width: `${u.pct}%` }} />
                </div>
              </div>
            </div>
          ))}

          {!disabled && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className={cn(
                "flex min-h-[100px] flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-muted-foreground/40 text-muted-foreground outline-none transition-colors hover:border-muted-foreground/70 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              <Plus className="size-5" />
              <span className="text-[11.5px]">Adicionar</span>
            </button>
          )}
        </div>
      )}

      {!disabled && (
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
          <Paperclip className="size-3" /> Imagem, PDF ou ZIP · até 15 MB
        </p>
      )}

      <Dialog open={viewing !== null} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="truncate pr-6">{viewing?.att.fileName}</DialogTitle>
            <DialogDescription>
              {viewing && `${fmtSize(viewing.att.size)} · ${viewing.att.uploaderName}`}
            </DialogDescription>
          </DialogHeader>
          {viewing && (
            <div className="flex flex-col gap-3">
              <div className="flex max-h-[70vh] items-center justify-center overflow-auto rounded-lg bg-popover">
                {/* imagem privada via URL assinada (host liberado no img-src do CSP) */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={viewing.url}
                  alt={viewing.att.fileName}
                  className="max-h-[70vh] w-auto object-contain"
                />
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => window.open(viewing.url, "_blank", "noopener,noreferrer")}
                >
                  Baixar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover anexo</DialogTitle>
            <DialogDescription>
              Remover <span className="text-foreground">{deleting?.fileName}</span>? O arquivo é apagado e não pode ser
              desfeito.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setDeleting(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              className="bg-amber text-primary-foreground hover:bg-amber/90"
              disabled={del.isPending}
              onClick={() => {
                if (deleting) del.mutate(deleting.id, { onSettled: () => setDeleting(null) });
              }}
            >
              {del.isPending ? "Removendo…" : "Remover"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
