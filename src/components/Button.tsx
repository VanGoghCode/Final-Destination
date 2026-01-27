"use client";

import React from "react";

export type ButtonVariant = "primary" | "secondary" | "regenerate" | "ghost";

const variantClasses: Record<ButtonVariant, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  regenerate: "btn-regenerate",
  ghost: "btn-ghost",
};

const variantGlow: Record<ButtonVariant, string> = {
  primary: "#6366f1",
  secondary: "currentColor",
  regenerate: "#10b981",
  ghost: "currentColor",
};

type CommonProps = {
  variant?: ButtonVariant;
  glow?: string;
  className?: string;
  children: React.ReactNode;
  as?: "button" | "a";
};

type ButtonProps = CommonProps &
  React.ButtonHTMLAttributes<HTMLButtonElement> &
  React.AnchorHTMLAttributes<HTMLAnchorElement>;

export default function Button({
  variant = "primary",
  glow,
  className,
  children,
  as = "button",
  ...props
}: ButtonProps) {
  const Component = as === "a" ? "a" : "button";
  const resolvedGlow = glow || variantGlow[variant];
  const classes = `${variantClasses[variant]}${className ? ` ${className}` : ""}`;
  const { style, ...rest } = props;

  return (
    <Component
      className={classes}
      style={{ ...(style || {}), "--btn-glow": resolvedGlow } as React.CSSProperties}
      {...(as === "button"
        ? { type: (props as React.ButtonHTMLAttributes<HTMLButtonElement>).type || "button" }
        : {})}
      {...rest}
    >
      {children}
    </Component>
  );
}
