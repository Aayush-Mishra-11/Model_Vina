"use client";

import { motion } from "framer-motion";
import {
  Mic,
  Wand2,
  MessagesSquare,
  Briefcase,
  BookOpen,
  Target,
  LineChart,
  Volume2,
  type LucideIcon,
} from "lucide-react";
import { FadeIn } from "@/components/page-transition";

interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
  span?: boolean;
}

const features: Feature[] = [
  {
    icon: Mic,
    title: "Live Speech-to-Text",
    description:
      "Real-time transcription as you speak, with word-level highlighting so you can follow along instantly.",
    span: true,
  },
  {
    icon: Wand2,
    title: "AI Grammar Correction",
    description: "Instant grammar, spelling, and style fixes with clear explanations.",
  },
  {
    icon: MessagesSquare,
    title: "AI Speaking Partner",
    description: "Chat naturally with an AI partner that adapts to your level and topic.",
  },
  {
    icon: Briefcase,
    title: "Mock Interviews",
    description: "Practice with role-specific questions and get scored feedback.",
  },
  {
    icon: BookOpen,
    title: "Vocabulary Builder",
    description: "Learn a word a day with flashcards, synonyms, and quizzes.",
  },
  {
    icon: Target,
    title: "Daily Speaking Challenge",
    description: "Storytelling, picture prompts, and debates to keep you consistent.",
  },
  {
    icon: LineChart,
    title: "Speech Analytics",
    description: "Track grammar, fluency, pronunciation, and confidence over time.",
  },
  {
    icon: Volume2,
    title: "Pronunciation Analysis",
    description: "Get a per-session pronunciation score and targeted tips.",
  },
];

export function LandingFeatures() {
  return (
    <section id="features" className="relative scroll-mt-24 py-24">
      <div className="container">
        <FadeIn className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-semibold uppercase tracking-wider text-primary">
            Everything you need
          </span>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            A complete communication gym
          </h2>
          <p className="mt-4 text-muted-foreground">
            From your first hesitant sentence to a confident interview — ConviAI covers
            every step of your speaking journey.
          </p>
        </FadeIn>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => (
            <FadeIn key={feature.title} delay={(i % 3) * 0.08}>
              <motion.div
                whileHover={{ y: -6 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className={`group relative flex h-full flex-col rounded-2xl border bg-card p-6 shadow-card transition-shadow hover:shadow-glow ${
                  feature.span ? "sm:col-span-2 lg:col-span-1" : ""
                }`}
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="font-display text-lg font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{feature.description}</p>
              </motion.div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
