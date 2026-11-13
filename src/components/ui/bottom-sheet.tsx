"use client";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "./dialog";
export function BottomSheet({open,onOpenChange,title,children,footer}: {open:boolean;onOpenChange:(open:boolean)=>void;title:string;children:React.ReactNode;footer?:React.ReactNode}) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent placement="bottom">
    <div className="flex justify-center pb-1 pt-2.5"><span className="h-1 w-9 rounded-full bg-surface-secondary-foreground/30" aria-hidden/></div>
    <DialogTitle className="px-4 pb-2 pr-14 text-[15px]">{title}</DialogTitle>
    <DialogDescription className="sr-only">{title}</DialogDescription>
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">{children}</div>
    {footer && <div className="flex items-center gap-3 border-t border-border px-4 py-3">{footer}</div>}
  </DialogContent></Dialog>;
}
