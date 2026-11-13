"use client";
import { SimpleSelect } from "./select";
export function SheetSelect<T extends string>({label,selected,options,onSelect,disabled,hint}:{label:string;selected:T|undefined;options:{value:T|undefined;label:string}[];onSelect:(value:T|undefined)=>void;disabled?:boolean;hint?:string}) {
  return <div className="flex flex-col gap-1.5"><SimpleSelect label={label} value={selected ?? ""} options={options.map(option=>({...option,value:option.value ?? ""}))} onValueChange={value=>onSelect(value === "" ? undefined : value as T)} disabled={disabled}/>{disabled && hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}</div>;
}
