"use client";

import { motion } from "framer-motion";
import { CheckCircle2, Zap, Heart, Globe } from "lucide-react";
import { FadeIn } from "@/components/page-transition";

const benefits = [
  {
    icon: Zap,
    title: "Speak more fluently",
    description: "Reduce hesitations and filler words with guided, low-pressure practice.",
  },
  {
    icon: CheckCircle2,
    title: "Fix grammar for good",
    description: "Context-aware corrections with explanations you'll actually remember.",
  },
  {
    icon: Heart,
    title: "Build real confidence",
    description: "Safe, judgment-free space to make mistakes and improve every day.",
  },
  {
    icon: Globe,
    title: "Sound more natural",
    description: "Vocabulary and pronunciation coaching that makes you sound like a native.",
  },
];

export function Benefits() {
  return (
    <section id="benefits" className="relative scroll-mt-24 py-24">
      <div className="container">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <FadeIn>
            <span className="text-sm font-semibold uppercase tracking-wider text-primary">
              Why ConviAI
            </span>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Confidence is a skill you can train
            </h2>
            <p className="mt-4 max-w-md text-muted-foreground">
              Most learners know the rules but freeze when speaking. ConviAI closes that gap
              with deliberate, repeatable practice.
            </p>
            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              {benefits.map((b) => (
                <div key={b.title} className="flex gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <b.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold">{b.title}</h4>
                    <p className="mt-1 text-sm text-muted-foreground">{b.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </FadeIn>

          <FadeIn delay={0.1}>
            <div className="relative">
              <div className="absolute -inset-4 -z-10 rounded-3xl bg-primary/10 blur-2xl" />
              <div className="glass-strong space-y-4 rounded-3xl p-6 shadow-card">
                {[
                  { label: "Grammar accuracy", value: 92, color: "bg-primary" },
                  { label: "Pronunciation", value: 84, color: "bg-accent" },
                  { label: "Fluency", value: 78, color: "bg-success" },
                  { label: "Confidence", value: 88, color: "bg-warning" },
                ].map((m) => (
                  <div key={m.label}>
                    <div className="mb-1.5 flex items-center justify-between text-sm">
                      <span className="font-medium">{m.label}</span>
                      <span className="text-muted-foreground">{m.value}%</span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-secondary">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: `${m.value}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
                        className={`h-full rounded-full ${m.color}`}
                      />
                    </div>
                  </div>
                ))}
                <div className="rounded-xl bg-gradient-to-r from-primary/10 to-accent/10 p-4 text-center">
                  <p className="font-display text-2xl font-bold text-gradient">+47%</p>
                  <p className="text-sm text-muted-foreground">average confidence uplift in 30 days</p>
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
