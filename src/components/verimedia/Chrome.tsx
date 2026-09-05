import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export function Panel({
  children,
  className = "",
  dashed = false,
}: {
  children: ReactNode;
  className?: string;
  dashed?: boolean;
}) {
  return (
    <div
      className={`clip-notch bg-panel border ${dashed ? "border-dashed border-line" : "border-line"} ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionLabel({ children, tone = "brand" }: { children: ReactNode; tone?: "brand" | "signal" }) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <span className={`h-px w-10 ${tone === "brand" ? "bg-brand" : "bg-signal"}`} />
      <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-dim">{children}</p>
    </div>
  );
}

export function Tag({ children, tone = "dim" }: { children: ReactNode; tone?: "dim" | "brand" | "signal" | "ink" }) {
  const tones = {
    dim: "text-dim border-line",
    brand: "text-brand border-brand/50",
    signal: "text-signal border-signal/50",
    ink: "text-ink border-ink/40",
  } as const;
  return (
    <span className={`h-fit shrink-0 border px-2 py-1 font-mono text-[9px] uppercase tracking-wide ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function SiteHeader() {
  return (
    <header className="flex items-center justify-between px-6 py-5 md:px-10">
      <Link to="/" className="flex items-center gap-3">
        <div className="clip-notch grid size-9 place-items-center bg-brand">
          <span className="font-display text-sm font-black leading-none text-primary-foreground">VM</span>
        </div>
        <div className="leading-none">
          <p className="font-display text-sm font-extrabold tracking-[0.14em]">VERIMEDIA&nbsp;AI</p>
          <p className="mt-1 font-mono text-[10px] tracking-widest text-dim">SIGNAL&nbsp;·&nbsp;01</p>
        </div>
      </Link>
      <nav className="hidden items-center gap-7 font-mono text-xs uppercase tracking-wider text-dim md:flex">
        <Link to="/" className="hover:text-ink [&.active]:text-ink">
          Overview
        </Link>
        <Link to="/method" className="hover:text-ink [&.active]:text-ink">
          Method
        </Link>
        <Link to="/reports" className="hover:text-ink [&.active]:text-ink">
          Reports
        </Link>
        <Link to="/privacy" className="hover:text-ink [&.active]:text-ink">
          Privacy
        </Link>
      </nav>
      <Link
        to="/analyze"
        className="clip-notch bg-ink px-5 py-2.5 font-display text-xs font-bold uppercase tracking-widest text-background transition-colors hover:bg-foreground"
      >
        Analyze Media
      </Link>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line px-6 py-8 md:px-10">
      <p className="font-mono text-[10px] uppercase tracking-widest text-dim">
        VeriMedia AI · Deterministic scoring · No fabricated evidence
      </p>
      <p className="font-mono text-[10px] uppercase tracking-widest text-dim">Prototype / Demo</p>
    </footer>
  );
}
