"use client";

import { motion } from "framer-motion";
import { Mic, Sparkles, LineChart, Award } from "lucide-react";
import { FadeIn } from "@/components/page-transition";
import { VoiceWave } from "@/components/voice-wave";

const steps = [
  {
    icon: Mic,
    title: "Speak",
    description:
      "Open a practice session and start talking. ConviAI transcribes your speech live and keeps you in English-only mode if you enable it.",
  },
  {
    icon: Sparkles,
    title: "Get corrected",
    description:
      "Receive instant grammar fixes, vocabulary upgrades, and pronunciation scores — all explained so you actually learn.",
  },
  {
    icon: LineChart,
    title: "Track progress",
    description:
      "Dashboards and charts show your grammar, confidence, fluency, and pace improving week over week.",
  },
  {
    icon: Award,
    title: "Earn & level up",
    description:
      "Complete daily challenges, unlock achievements, and collect certificates as your skills grow.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative scroll-mt-24 py-24">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-grid [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
      <div className="container">
        <FadeIn className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-semibold uppercase tracking-wider text-primary">
            How it works
          </span>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Three minutes a day, real results
          </h2>
        </FadeIn>

        <div className="relative mt-16">
          <div className="absolute left-0 right-0 top-8 hidden h-px bg-gradient-to-r from-transparent via-border to-transparent lg:block" />
          <div className="grid gap-10 lg:grid-cols-4">
            {steps.map((step, i) => (
              <FadeIn key={step.title} delay={i * 0.1}>
                <div className="relative flex flex-col items-center text-center">
                  <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-premium-gradient text-white shadow-glow">
                    <step.icon className="h-7 w-7" />
                    <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border bg-card text-xs font-bold">
                      {i + 1}
                    </span>
                  </div>
                  <h3 className="mt-5 font-display text-lg font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{step.description}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>

        <div className="mt-16 flex justify-center">
          <div className="glass flex items-center gap-4 rounded-2xl px-6 py-4 shadow-card">
            <VoiceWave active bars={24} className="h-8" />
            <span className="text-sm text-muted-foreground">Your voice, analyzed in real time</span>
          </div>
        </div>
      </div>
    </section>
  );
}
