"use client";

import * as React from "react";
import { Button as HeroButton, Link as HeroLink } from "@heroui/react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "ui-button inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        // Confirmação de ação destrutiva. Segue a régua Corex: "tudo menta" (bg-amber → --primary),
        // peso pela cor da marca, não vermelho. text-destructive fica só p/ erro de form. [identidade-corex]
        danger: "bg-amber text-primary-foreground hover:bg-amber/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-transparent hover:bg-surface-tertiary hover:text-foreground",
        ghost: "hover:bg-surface-tertiary hover:text-foreground",
        unstyled: "",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-6",
        icon: "size-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

function composeEvent<T extends React.SyntheticEvent>(child: ((event:T)=>void)|undefined, parent: ((event:T)=>void)|undefined) {
  return (event:T)=>{child?.(event);if(!event.defaultPrevented)parent?.(event);};
}
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const { disabled, children, type = "button", onFocus, onBlur, onKeyDown, onKeyUp, onClick, value, ...rest } = props;
    const classes = variant === "unstyled"
      ? cn("ui-button-reset", className)
      : cn(buttonVariants({ variant, size, className }));
    if (asChild && React.isValidElement<ButtonProps & React.RefAttributes<HTMLButtonElement>>(children) && children.type === Button) {
      return React.cloneElement(children, {...props, ...children.props, ref:node=>{const childRef=children.props.ref;if(typeof childRef === "function")childRef(node);else if(childRef)childRef.current=node;if(typeof ref === "function")ref(node);else if(ref)ref.current=node;}, className:cn(classes,children.props.className),
        onClick:composeEvent(children.props.onClick,onClick), onKeyDown:composeEvent(children.props.onKeyDown,onKeyDown), onKeyUp:composeEvent(children.props.onKeyUp,onKeyUp),
      });
    }
    if (asChild && React.isValidElement<{href?: string; children?: React.ReactNode; className?: string}>(children) && children.props.href) {
      return <HeroLink href={children.props.href} isDisabled={disabled} className={classes}
        render={linkProps => React.cloneElement(children, {...children.props, ...linkProps, className: cn(classes, children.props.className)})}
      >{children.props.children}</HeroLink>;
    }
    return <HeroButton ref={ref} value={value == null ? undefined : String(value)} isPending={props["aria-busy"] === true || props["aria-busy"] === "true"} type={type} isDisabled={disabled}
      variant={variant === "destructive" ? "danger" : variant === "ghost" || variant === "link" || variant === "unstyled" ? "ghost" : variant === "secondary" || variant === "outline" ? "secondary" : "primary"}
      className={classes} {...rest}
      onClick={onClick ? e => onClick(e as React.MouseEvent<HTMLButtonElement>) : undefined}
      onFocus={onFocus ? e => onFocus(e as React.FocusEvent<HTMLButtonElement>) : undefined}
      onBlur={onBlur ? e => onBlur(e as React.FocusEvent<HTMLButtonElement>) : undefined}
      onKeyDown={onKeyDown ? e => onKeyDown(e as React.KeyboardEvent<HTMLButtonElement>) : undefined}
      onKeyUp={onKeyUp ? e => onKeyUp(e as React.KeyboardEvent<HTMLButtonElement>) : undefined}
      render={renderProps => asChild && React.isValidElement<React.HTMLAttributes<HTMLElement>>(children) ? React.cloneElement(children, {
        ...renderProps, ...children.props,
        className: cn(renderProps.className, children.props.className),
        onClick: composeEvent(children.props.onClick, renderProps.onClick),
        onKeyDown: composeEvent(children.props.onKeyDown, renderProps.onKeyDown),
        onKeyUp: composeEvent(children.props.onKeyUp, renderProps.onKeyUp),
        onPointerDown: composeEvent(children.props.onPointerDown, renderProps.onPointerDown),
        onPointerUp: composeEvent(children.props.onPointerUp, renderProps.onPointerUp),
        onFocus: composeEvent(children.props.onFocus, renderProps.onFocus),
        onBlur: composeEvent(children.props.onBlur, renderProps.onBlur),
      }) : <button {...renderProps} role={props.role} aria-busy={props["aria-busy"]} />}
    >{asChild && React.isValidElement<{children?: React.ReactNode}>(children) ? children.props.children : children}</HeroButton>;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
