"use client";
import * as React from "react";
import { Accordion } from "@heroui/react";
export function Disclosure({title, children, defaultOpen, open, onOpenChange, className, hidden}: {title: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean; open?: boolean; onOpenChange?: (open: boolean) => void; className?: string; hidden?: boolean}) {
  return <Accordion hidden={hidden} className={className} expandedKeys={open === undefined ? undefined : open ? ["content"] : []} defaultExpandedKeys={defaultOpen ? ["content"] : []} onExpandedChange={keys => onOpenChange?.(keys.has("content"))}>
    <Accordion.Item id="content"><Accordion.Heading><Accordion.Trigger>{title}<Accordion.Indicator /></Accordion.Trigger></Accordion.Heading><Accordion.Panel><Accordion.Body>{children}</Accordion.Body></Accordion.Panel></Accordion.Item>
  </Accordion>;
}
