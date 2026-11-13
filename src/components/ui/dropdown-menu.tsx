"use client";
import * as React from "react";
import { Popover, Separator } from "@heroui/react";
import { Check } from "lucide-react";
import { Button, type ButtonProps } from "./button";
import { cn } from "@/lib/utils";

const MenuContext=React.createContext({close:()=>{}});
// Popover supports the existing rich filters (inputs and preset editors), unlike a Menu collection.
export function DropdownMenu({children,open,defaultOpen,onOpenChange}: {children:React.ReactNode;open?:boolean;defaultOpen?:boolean;onOpenChange?:(open:boolean)=>void;modal?:boolean}) {
  const [internal,setInternal]=React.useState(defaultOpen ?? false);
  const change=(value:boolean)=>{setInternal(value);onOpenChange?.(value);};
  return <MenuContext.Provider value={{close:()=>change(false)}}><Popover isOpen={open ?? internal} onOpenChange={change}>{children}</Popover></MenuContext.Provider>;
}
export const DropdownMenuTrigger=React.forwardRef<HTMLButtonElement,ButtonProps>((props,ref)=><Button variant="unstyled" ref={ref} {...props}/>);
DropdownMenuTrigger.displayName="DropdownMenuTrigger";
export const DropdownMenuContent=React.forwardRef<HTMLElement,Omit<React.HTMLAttributes<HTMLElement>,"role"> & {role?:"dialog"|"alertdialog";align?:"start"|"center"|"end";side?:"top"|"bottom";sideOffset?:number}>(({className,align="start",side="bottom",sideOffset=6,children,...props},ref)=>
  <Popover.Content placement={align === "center" ? side : `${side} ${align}`} offset={sideOffset} className="z-[80]">
    <Popover.Dialog aria-label="Opções" className={cn("min-w-[12rem] overflow-hidden rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg outline-none",className)} {...props} render={domProps=><section {...domProps} role="menu" ref={node=>{const inner=domProps.ref;if(typeof inner === "function")inner(node);else if(inner)inner.current=node;if(typeof ref === "function")ref(node);else if(ref)ref.current=node;}} onKeyDown={event=>{
      props.onKeyDown?.(event);
      if(event.defaultPrevented || !["ArrowDown","ArrowUp","Home","End"].includes(event.key))return;
      if(event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)return;
      const items=Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[data-corex-menu-item]:not([disabled])'));
      if(!items.length)return;
      event.preventDefault();
      const current=items.indexOf(document.activeElement as HTMLElement);
      const next=event.key==="Home"?0:event.key==="End"?items.length-1:event.key==="ArrowDown"?(current+1)%items.length:(current-1+items.length)%items.length;
      items[next]?.focus();
    }}/>}>{children}</Popover.Dialog>
  </Popover.Content>
);
DropdownMenuContent.displayName="DropdownMenuContent";
export const DropdownMenuItem=React.forwardRef<HTMLButtonElement,Omit<ButtonProps,"onSelect"> & {active?:boolean;onSelect?:(event:Event)=>void}>(({className,active,children,onSelect,onClick,...props},ref)=>{
  const {close}=React.useContext(MenuContext);
  return <Button ref={ref} variant="unstyled" role="menuitem" data-corex-menu-item="" className={cn("relative flex w-full cursor-pointer select-none items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm outline-none transition-colors hover:bg-surface-tertiary focus:bg-surface-tertiary focus:text-foreground",className)} {...props} onClick={event=>{
    onClick?.(event);if(event.defaultPrevented)return;
    const selection=new Event("select",{cancelable:true});onSelect?.(selection);if(!selection.defaultPrevented)close();
  }}>{children}{active && <Check className="ml-auto size-3.5 text-primary"/>}</Button>;
});
DropdownMenuItem.displayName="DropdownMenuItem";
export const DropdownMenuSeparator=React.forwardRef<HTMLElement,React.ComponentProps<typeof Separator>>(({className,...props},ref)=><Separator ref={ref} className={cn("-mx-1 my-1 h-px bg-border",typeof className === "string" ? className : undefined)} {...props}/>);
DropdownMenuSeparator.displayName="DropdownMenuSeparator";
export const DropdownMenuGroup=React.forwardRef<HTMLDivElement,React.HTMLAttributes<HTMLDivElement>>((props,ref)=><div ref={ref} role="group" {...props}/>);
DropdownMenuGroup.displayName="DropdownMenuGroup";
export const DropdownMenuLabel=React.forwardRef<HTMLDivElement,React.HTMLAttributes<HTMLDivElement>>(({className,...props},ref)=><div ref={ref} className={cn("px-2.5 pb-1 pt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground",className)} {...props}/>);
DropdownMenuLabel.displayName="DropdownMenuLabel";
