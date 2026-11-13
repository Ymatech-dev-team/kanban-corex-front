"use client";
import { Select, ListBox, Label } from "@heroui/react";
import { cn } from "@/lib/utils";
export interface SimpleSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: {value: string; label: string; disabled?: boolean}[];
  label?: string;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  className?: string;
  id?: string;
  name?: string;
  "aria-label"?: string;
}
// React Aria reserves the empty key for no selection. Map it to a stable internal key.
const emptyKey = "__corex_empty_option__";
export function SimpleSelect({value, onValueChange, options, label, disabled, required, className, ...props}: SimpleSelectProps) {
  return <Select selectedKey={value === "" ? emptyKey : value} onSelectionChange={key => onValueChange(key === emptyKey || key == null ? "" : String(key))} isDisabled={disabled} isRequired={required} className={cn("w-full",className)} aria-label={props["aria-label"] ?? (label ? undefined : "Selecionar opção")} {...props}>
    {label && <Label>{label}</Label>}
    <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
    <Select.Popover className="z-[80]"><ListBox>{options.map(option => <ListBox.Item key={option.value || emptyKey} id={option.value || emptyKey} textValue={option.label} isDisabled={option.disabled}>{option.label}<ListBox.ItemIndicator /></ListBox.Item>)}</ListBox></Select.Popover>
  </Select>;
}
