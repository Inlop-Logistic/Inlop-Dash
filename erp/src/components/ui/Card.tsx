import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padding?: "none" | "sm" | "md" | "lg";
}

const PAD: Record<NonNullable<CardProps["padding"]>, string> = {
  none: "",
  sm:   "p-4",
  md:   "p-5",
  lg:   "p-6",
};

export function Card({ children, padding = "none", className = "", style, ...rest }: CardProps) {
  return (
    <div
      className={`bg-white rounded-2xl overflow-hidden ${PAD[padding]} ${className}`}
      style={{ border: "1px solid var(--gray-100)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", ...style }}
      {...rest}
    >
      {children}
    </div>
  );
}

interface CardSectionProps { children: ReactNode; className?: string }

export function CardSection({ children, className = "" }: CardSectionProps) {
  return (
    <div className={`px-5 py-4 ${className}`} style={{ borderTop: "1px solid var(--gray-100)" }}>
      {children}
    </div>
  );
}
