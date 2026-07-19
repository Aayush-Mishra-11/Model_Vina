"use client";

import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { Logo } from "@/components/logo";
import { VoiceWave } from "@/components/voice-wave";
import { Mic, Sparkles, ShieldCheck } from "lucide-react";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand / hero panel */}
      <div className="relative hidden overflow-hidden bg-premium-gradient lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="pointer-events-none absolute inset-0 opacity-30 [background:radial-gradient(circle_at_30%_20%,white,transparent_40%),radial-gradient(circle_at_80%_70%,white,transparent_35%)]" />
        <Link href="/" className="relative z-10">
          <span className="flex items-center gap-2.5 text-white">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
              <Mic className="h-5 w-5" />
            </span>
            <span className="font-display text-lg font-bold">ConviAI</span>
          </span>
        </Link>
        <div className="relative z-10 max-w-md text-white">
          <h2 className="font-display text-3xl font-bold leading-tight">
            Your AI coach for fluent, confident English.
          </h2>
          <p className="mt-4 text-white/80">
            Practice speaking, get instant corrections, and watch your confidence grow — every
            single day.
          </p>
          <div className="mt-8 flex items-center gap-3 rounded-2xl bg-white/10 p-4 backdrop-blur">
            <VoiceWave active bars={28} color="rgba(255,255,255,0.9)" className="h-10" />
          </div>
        </div>
        <div className="relative z-10 flex gap-6 text-sm text-white/80">
          <span className="flex items-center gap-1.5"><Sparkles className="h-4 w-4" /> Smart AI</span>
          <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4" /> Secure</span>
        </div>
      </div>

      {/* Form panel */}
      <div className="relative flex flex-col px-6 py-8 sm:px-12">
        <div className="flex items-center justify-between">
          <Link href="/" className="lg:hidden">
            <Logo />
          </Link>
          <div className="ml-auto flex items-center gap-3">
            <ThemeToggle />
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm">
            <div className="mb-8 text-center lg:text-left">
              <h1 className="font-display text-2xl font-bold tracking-tight">{title}</h1>
              <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
            </div>
            {children}
            {footer && <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
