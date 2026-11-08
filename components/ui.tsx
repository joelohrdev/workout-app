"use client";

import { useEffect, type ReactNode } from "react";
import { MinusIcon, PlusIcon, XIcon } from "./Icons";

export function PageHeader({
  title,
  eyebrow,
  action,
}: {
  title: string;
  eyebrow?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="flex items-end justify-between gap-3 pt-6 pb-4">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-xs font-semibold tracking-[0.14em] text-muted uppercase">{eyebrow}</p>
        )}
        <h1 className="font-display text-4xl leading-none font-bold tracking-tight uppercase">
          {title}
        </h1>
      </div>
      {action}
    </header>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-line bg-surface p-4 ${className}`}>
      {children}
    </section>
  );
}

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger" | "cardio";
  size?: "md" | "lg" | "sm";
};

export function Button({ variant = "primary", size = "md", className = "", ...props }: BtnProps) {
  const v = {
    primary: "bg-accent text-accent-ink hover:brightness-110",
    cardio: "bg-cardio text-accent-ink hover:brightness-110",
    ghost: "bg-surface-2 text-text hover:bg-line",
    danger: "bg-danger/15 text-danger hover:bg-danger/25",
  }[variant];
  const s = { sm: "h-9 px-3 text-sm", md: "h-11 px-4", lg: "h-14 px-6 text-lg" }[size];
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition active:scale-[0.98] disabled:opacity-40 ${v} ${s} ${className}`}
    />
  );
}

export function Stat({
  label,
  value,
  unit,
  tone = "text",
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  tone?: "text" | "accent" | "cardio";
}) {
  const color = { text: "text-text", accent: "text-accent", cardio: "text-cardio" }[tone];
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold tracking-[0.12em] text-muted uppercase">{label}</p>
      <p className={`font-display tabular text-3xl leading-tight font-bold ${color}`}>
        {value}
        {unit && <span className="ml-1 text-base font-semibold text-muted">{unit}</span>}
      </p>
    </div>
  );
}

export function Stepper({
  value,
  onChange,
  min = 0,
  max = 999,
  step = 1,
  label,
  suffix,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label: string;
  suffix?: string;
}) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">{label}</span>
      <div className="flex h-10 items-center rounded-xl bg-surface-2">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          onClick={() => onChange(clamp(value - step))}
          className="grid h-10 w-9 place-items-center text-muted"
        >
          <MinusIcon width={16} height={16} />
        </button>
        <span className="tabular min-w-10 flex-1 text-center font-semibold">
          {value}
          {suffix && <span className="text-xs text-muted">{suffix}</span>}
        </span>
        <button
          type="button"
          aria-label={`Increase ${label}`}
          onClick={() => onChange(clamp(value + step))}
          className="grid h-10 w-9 place-items-center text-muted"
        >
          <PlusIcon width={16} height={16} />
        </button>
      </div>
    </div>
  );
}

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="pb-safe flex max-h-[92dvh] w-full max-w-xl flex-col rounded-t-3xl border-t border-line bg-surface"
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <h2 className="font-display text-2xl font-bold uppercase">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="grid h-10 w-10 place-items-center rounded-full bg-surface-2">
            <XIcon width={18} height={18} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 pb-6">{children}</div>
      </div>
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-xl bg-surface-2 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold whitespace-nowrap ${
            value === o.value ? "bg-text text-bg" : "text-muted"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function NumberInput({
  value,
  onChange,
  placeholder,
  className = "",
  ariaLabel,
  decimal = true,
}: {
  value: number | null;
  onChange: (n: number | null) => void;
  placeholder?: string;
  className?: string;
  ariaLabel: string;
  decimal?: boolean;
}) {
  return (
    <input
      type="number"
      inputMode={decimal ? "decimal" : "numeric"}
      aria-label={ariaLabel}
      placeholder={placeholder}
      value={value ?? ""}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v === "" ? null : Number(v));
      }}
      className={`tabular h-11 w-full rounded-xl bg-surface-2 px-3 text-center text-lg font-semibold outline-none placeholder:text-muted/60 focus:ring-2 focus:ring-accent ${className}`}
    />
  );
}
