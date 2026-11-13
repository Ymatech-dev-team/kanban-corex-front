"use client";
import * as React from "react";
import { Tabs as HeroTabs } from "@heroui/react";
import { cn } from "@/lib/utils";
export function Tabs({value, defaultValue, onValueChange, ...props}: Omit<React.ComponentProps<typeof HeroTabs>, "selectedKey" | "defaultSelectedKey" | "onSelectionChange"> & {value?: string; defaultValue?: string; onValueChange?: (value: string) => void}) {
  return <HeroTabs variant="secondary" selectedKey={value} defaultSelectedKey={defaultValue} onSelectionChange={key => onValueChange?.(String(key))} {...props} />;
}
export const TabsList = React.forwardRef<HTMLDivElement, React.ComponentProps<typeof HeroTabs.List>>(({className,...props},ref) => <HeroTabs.ListContainer className="w-full"><HeroTabs.List ref={ref} className={cn("corex-tabs-list w-full justify-start gap-5", typeof className === "string" ? className : undefined)} {...props} /></HeroTabs.ListContainer>);
TabsList.displayName="TabsList";
export const TabsTrigger = React.forwardRef<HTMLDivElement, Omit<React.ComponentProps<typeof HeroTabs.Tab>,"id"> & {value:string; disabled?:boolean;title?:string}>(({value,disabled,title,children,className,...props},ref) => <HeroTabs.Tab ref={ref} id={value} isDisabled={disabled} className={cn("w-auto flex-none px-0.5 py-3", typeof className === "string" ? className : undefined)} render={domProps=><div {...domProps as React.ComponentProps<"div">} title={title}/>} {...props}>{state=><>{typeof children === "function" ? children(state) : children}<HeroTabs.Indicator/></>}</HeroTabs.Tab>);
TabsTrigger.displayName="TabsTrigger";
export const TabsContent = React.forwardRef<HTMLDivElement, Omit<React.ComponentProps<typeof HeroTabs.Panel>,"id"> & {value:string;forceMount?:boolean}>(({value,forceMount,...props},ref) => <HeroTabs.Panel ref={ref} id={value} shouldForceMount={forceMount} {...props} />);
TabsContent.displayName="TabsContent";
