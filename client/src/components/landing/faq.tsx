"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, HelpCircle } from "lucide-react";
import { FadeIn } from "@/components/page-transition";
import { cn } from "@/lib/utils";

const faqs = [
  {
    q: "Do I need to install anything?",
    a: "No. ConviAI runs entirely in your browser. Just allow microphone access and start speaking.",
  },
  {
    q: "What is English-only mode?",
    a: "When enabled, ConviAI warns you if you switch to another language, helping you stay immersed during practice.",
  },
  {
    q: "How accurate is the grammar correction?",
    a: "Corrections are powered by large language models tuned for ESL learners, with explanations so you understand the fix.",
  },
  {
    q: "Can I use ConviAI for interview prep?",
    a: "Yes. The Mock Interview feature lets you pick a company and difficulty, answers questions aloud, and receives a scored report.",
  },
  {
    q: "Is my audio data private?",
    a: "Audio is processed securely for transcription and analysis. You can delete your history anytime from settings.",
  },
  {
    q: "Does it work on mobile?",
    a: "Absolutely. The interface is fully responsive and works on phones, tablets, and desktops.",
  },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="relative scroll-mt-24 py-24">
      <div className="container">
        <FadeIn className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-semibold uppercase tracking-wider text-primary">
            FAQ
          </span>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Questions, answered
          </h2>
        </FadeIn>

        <div className="mx-auto mt-12 max-w-3xl space-y-3">
          {faqs.map((faq, i) => (
            <FadeIn key={faq.q} delay={i * 0.05}>
              <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
                <button
                  onClick={() => setOpen(open === i ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                >
                  <span className="flex items-center gap-3 font-medium">
                    <HelpCircle className="h-4 w-4 text-primary" />
                    {faq.q}
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-5 w-5 shrink-0 text-muted-foreground transition-transform",
                      open === i && "rotate-180",
                    )}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {open === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                    >
                      <p className="px-5 pb-5 pl-12 text-sm text-muted-foreground">{faq.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
