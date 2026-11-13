"use client";
import * as React from "react";
import { Modal, Description } from "@heroui/react";
import { X } from "lucide-react";
import { Button, type ButtonProps } from "./button";
import { cn } from "@/lib/utils";

const DialogContext = React.createContext<{close:()=>void;descriptionId:string;dismissGuard:React.RefObject<(() => boolean)|null>;escapeDismiss:React.RefObject<boolean>;isOpen:boolean;requestChange:(open:boolean)=>void}>({close:()=>{},descriptionId:"",dismissGuard:{current:null},escapeDismiss:{current:false},isOpen:false,requestChange:()=>{}});
export function Dialog({open, defaultOpen, onOpenChange, children}: {open?:boolean;defaultOpen?:boolean;onOpenChange?:(open:boolean)=>void;children:React.ReactNode}) {
  const [internal, setInternal] = React.useState(defaultOpen ?? false);
  const descriptionId = React.useId();
  const dismissGuard=React.useRef<(() => boolean)|null>(null);
  const escapeDismiss=React.useRef(false);
  const setOpen = (value:boolean) => {setInternal(value);onOpenChange?.(value);};
  const requestChange=(value:boolean)=>{
    if(!value){const escape=escapeDismiss.current;escapeDismiss.current=false;if(!escape && dismissGuard.current && !dismissGuard.current())return;}setOpen(value);
  };
  const hasTrigger=React.Children.toArray(children).some(child=>React.isValidElement(child) && child.type===DialogTrigger);
  return <DialogContext.Provider value={{close:()=>setOpen(false),descriptionId,dismissGuard,escapeDismiss,isOpen:open ?? internal,requestChange}}>
    {hasTrigger ? <Modal isOpen={open ?? internal} onOpenChange={requestChange}>{children}</Modal> : children}
  </DialogContext.Provider>;
}
export const DialogTrigger = React.forwardRef<HTMLButtonElement,ButtonProps>((props,ref) => <Button ref={ref} {...props}/>);
DialogTrigger.displayName="DialogTrigger";
export const DialogClose = React.forwardRef<HTMLButtonElement,ButtonProps>(({onClick,...props},ref) => {
  const {close}=React.useContext(DialogContext);
  return <Button ref={ref} {...props} onClick={event=>{onClick?.(event);if(!event.defaultPrevented)close();}}/>;
});
DialogClose.displayName="DialogClose";
interface ContentProps extends Omit<React.HTMLAttributes<HTMLElement>, "role"> {
  role?: "dialog"|"alertdialog";
  placement?: "center"|"right"|"left"|"bottom";
  showCloseButton?:boolean;
  onOpenAutoFocus?:(event:Event)=>void;
  onCloseAutoFocus?:(event:Event)=>void;
  onEscapeKeyDown?:(event:KeyboardEvent)=>void;
  onInteractOutside?:(event:Event)=>void;
}
export const DialogContent = React.forwardRef<HTMLElement,ContentProps>(({placement="center",showCloseButton=true,className,children,onOpenAutoFocus,onCloseAutoFocus,onEscapeKeyDown,onInteractOutside,...props},ref)=> {
  const {dismissGuard,isOpen,requestChange}=React.useContext(DialogContext);
  React.useLayoutEffect(()=>{dismissGuard.current=()=>{const event=new Event("interactoutside",{cancelable:true});onInteractOutside?.(event);return !event.defaultPrevented;};return()=>{dismissGuard.current=null;};},[dismissGuard,onInteractOutside]);
  return <Modal.Backdrop isOpen={isOpen} onOpenChange={requestChange} className="ui-dialog-overlay fixed inset-0 z-50 bg-black/45">
    <Modal.Container placement={placement === "bottom" ? "bottom" : "center"} className={cn("corex-modal-container", placement === "right" && "corex-modal-container-right", placement === "left" && "corex-modal-container-left", placement === "bottom" && "corex-modal-container-bottom")}>
      <DialogSurface ref={ref} placement={placement} className={className} showCloseButton={showCloseButton} onOpenAutoFocus={onOpenAutoFocus} onCloseAutoFocus={onCloseAutoFocus} onEscapeKeyDown={onEscapeKeyDown} {...props}>{children}</DialogSurface>
    </Modal.Container>
  </Modal.Backdrop>;
});
DialogContent.displayName="DialogContent";
const DialogSurface=React.forwardRef<HTMLElement,ContentProps>(({placement,showCloseButton,className,children,onOpenAutoFocus,onCloseAutoFocus,onEscapeKeyDown,...props},ref)=>{
  const {descriptionId,escapeDismiss}=React.useContext(DialogContext);
  const callbacks=React.useRef({onOpenAutoFocus,onCloseAutoFocus});
  callbacks.current={onOpenAutoFocus,onCloseAutoFocus};
  React.useLayoutEffect(()=>{
    const originalFocus=document.activeElement;
    const openEvent=new Event("openautofocus",{cancelable:true});
    callbacks.current.onOpenAutoFocus?.(openEvent);
    return ()=>{
      const event=new Event("closeautofocus",{cancelable:true});
      callbacks.current.onCloseAutoFocus?.(event);
      if(event.defaultPrevented && originalFocus instanceof HTMLElement){
        // React Aria exposes a cancelable restoration event for consumers that restore elsewhere.
        const preventRestore=(restore:Event)=>restore.preventDefault();
        originalFocus.addEventListener("react-aria-focus-scope-restore",preventRestore);
        requestAnimationFrame(()=>requestAnimationFrame(()=>originalFocus.removeEventListener("react-aria-focus-scope-restore",preventRestore)));
      }
    };
  },[]);
  return <Modal.Dialog aria-describedby={descriptionId} className={cn(
    (placement === "right" || placement === "left") ? "ui-task-panel flex h-dvh w-full flex-col overflow-hidden rounded-none border-l border-border bg-background p-0 shadow-xl sm:w-[min(780px,calc(100vw-4rem))]" : placement === "bottom" ? "flex max-h-[82dvh] w-full flex-col rounded-t-2xl border-t border-border bg-card p-0 pb-[env(safe-area-inset-bottom)]" : "ui-dialog-content grid max-h-[calc(100dvh-2rem)] w-full max-w-md gap-4 overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-xl",className)}
    {...props} render={domProps=><section {...domProps} ref={node=>{const inner=domProps.ref;if(typeof inner === "function")inner(node);else if(inner)inner.current=node;if(typeof ref === "function")ref(node);else if(ref)ref.current=node;}} onKeyDownCapture={event=>{props.onKeyDownCapture?.(event);if(event.key==="Escape" && event.target instanceof Element && event.target.closest('[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]') === event.currentTarget){escapeDismiss.current=true;onEscapeKeyDown?.(event.nativeEvent);if(event.nativeEvent.defaultPrevented){escapeDismiss.current=false;event.preventDefault();event.stopPropagation();}}}}/>}>
    {children}
    {showCloseButton && <DialogClose variant="ghost" size="icon" className="absolute right-3 top-3" aria-label="Fechar"><X className="size-4"/></DialogClose>}
  </Modal.Dialog>;
});
DialogSurface.displayName="DialogSurface";
export function DialogHeader({className,...props}:React.HTMLAttributes<HTMLDivElement>){return <Modal.Header className={cn("flex flex-col gap-1.5",className)} {...props}/>;}
export const DialogTitle=React.forwardRef<HTMLHeadingElement,React.HTMLAttributes<HTMLHeadingElement>>(({className,...props},ref)=><Modal.Heading ref={ref} className={cn("text-lg font-semibold tracking-tight",className)} {...props}/>);
DialogTitle.displayName="DialogTitle";
export const DialogDescription=React.forwardRef<HTMLElement,React.HTMLAttributes<HTMLElement>>(({className,...props},ref)=>{
  const {descriptionId}=React.useContext(DialogContext);
  return <Description ref={ref} id={descriptionId} className={cn("text-sm text-muted-foreground",className)} {...props}/>;
});
DialogDescription.displayName="DialogDescription";
