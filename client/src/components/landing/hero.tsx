"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Mic, Sparkles, Languages, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { VoiceWave } from "@/components/voice-wave";

export function LandingHero() {
  return (
    <section className="relative overflow-hidden pb-20 pt-36 lg:pt-44">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-[480px] w-[820px] -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]" />
        <div className="absolute right-10 top-40 h-[320px] w-[320px] rounded-full bg-accent/20 blur-[100px]" />
        <div className="absolute left-10 top-60 h-[280px] w-[280px] rounded-full bg-primary/10 blur-[100px]" />
      </div>

      <div className="container">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Badge variant="secondary" className="mb-5 gap-1.5 px-3 py-1">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Powered by advanced AI speech models
            </Badge>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="font-display text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl"
          >
            Speak English with{" "}
            <span className="text-gradient">confidence</span>, powered by your AI coach
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.12 }}
            className="mt-6 max-w-xl text-balance text-lg text-muted-foreground"
          >
            ConviAI listens, corrects, and guides you in real time. Improve your grammar,
            pronunciation, and fluency through live practice, mock interviews, and daily
            challenges.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.18 }}
            className="mt-9 flex flex-col items-center gap-3 sm:flex-row"
          >
            <Button size="lg" variant="gradient" asChild>
              <Link href="/signup">
                Start practicing free <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/login">I already have an account</Link>
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground"
          >
            <span className="flex items-center gap-1.5"><Mic className="h-4 w-4 text-primary" /> Live speech-to-text</span>
            <span className="flex items-center gap-1.5"><Languages className="h-4 w-4 text-primary" /> English-only mode</span>
            <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-primary" /> Private & secure</span>
          </motion.div>
        </div>

        {/* Floating mic card */}
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto mt-16 max-w-2xl"
        >
          <div className="glass-strong relative overflow-hidden rounded-3xl p-8 shadow-card">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
            <div className="flex flex-col items-center gap-6">
              <div className="relative flex h-28 w-28 items-center justify-center">
                <span className="absolute inset-0 animate-pulse-ring rounded-full bg-primary/30" />
                <span className="absolute inset-0 rounded-full bg-primary/10" />
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-premium-gradient shadow-glow">
                  <Mic className="h-9 w-9 text-white" />
                </div>
              </div>
              <VoiceWave active bars={40} className="h-12" />
              <div className="w-full space-y-3">
                <p className="rounded-xl bg-secondary/60 px-4 py-3 text-left text-sm">
                  “I think the meeting will be start at nine o'clock…”
                </p>
                <p className="rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-left text-sm">
                  ✓ “I think the meeting <span className="font-medium text-success">will start</span> at nine o'clock.”
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
