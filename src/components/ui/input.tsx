"use client";
import * as React from "react";
import { Input as HeroInput, Checkbox } from "@heroui/react";
import { cn } from "@/lib/utils";

const CheckboxInput = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({checked, defaultChecked, disabled, required, onChange, className, id, name, value, "aria-label": ariaLabel, ...props}, ref) => {
    const input = React.useRef<HTMLInputElement>(null);
    React.useImperativeHandle(ref, () => input.current!);
    return <Checkbox render={domProps=><div {...domProps} onChangeCapture={event=>onChange?.(event as React.ChangeEvent<HTMLInputElement>)}/>} id={id} inputRef={input} isSelected={checked} defaultSelected={defaultChecked} isDisabled={disabled} isRequired={required} name={name} value={typeof value === "string" ? value : undefined} className={cn("corex-checkbox", className)} aria-label={ariaLabel} aria-labelledby={props["aria-labelledby"]} aria-describedby={props["aria-describedby"]}>
      <Checkbox.Content><Checkbox.Control><Checkbox.Indicator /></Checkbox.Control></Checkbox.Content>
    </Checkbox>;
  }
);
CheckboxInput.displayName = "CheckboxInput";
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({className, type, ...props}, ref) => type === "checkbox"
    ? <CheckboxInput ref={ref} className={className} {...props} />
    : <HeroInput ref={ref} type={type} className={cn("corex-input", className)} {...props} />
);
Input.displayName = "Input";
export { Input };
