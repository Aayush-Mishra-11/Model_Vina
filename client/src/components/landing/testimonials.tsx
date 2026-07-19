"use client";

import { motion } from "framer-motion";
import { Star } from "lucide-react";
import { FadeIn } from "@/components/page-transition";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";

const testimonials = [
  {
    name: "Priya Sharma",
    role: "Software Engineer",
    content:
      "I landed my dream job after two weeks of mock interviews with ConviAI. The feedback was shockingly accurate and actionable.",
    rating: 5,
  },
  {
    name: "Daniel Okafor",
    role: "MBA Student",
    content:
      "The English-only mode forced me out of my comfort zone. My fluency improved faster than in a year of classes.",
    rating: 5,
  },
  {
    name: "Mei Lin",
    role: "Customer Success",
    content:
      "I love the daily challenge. It's like Duolingo but for actually speaking out loud. The streak keeps me coming back.",
    rating: 5,
  },
];

export function Testimonials() {
  return (
    <section id="testimonials" className="relative scroll-mt-24 py-24">
      <div className="container">
        <FadeIn className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-semibold uppercase tracking-wider text-primary">
            Loved by learners
          </span>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Real progress, real stories
          </h2>
        </FadeIn>

        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {testimonials.map((t, i) => (
            <FadeIn key={t.name} delay={i * 0.1}>
              <motion.div
                whileHover={{ y: -6 }}
                className="flex h-full flex-col rounded-2xl border bg-card p-6 shadow-card"
              >
                <div className="flex gap-0.5 text-warning">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-current" />
                  ))}
                </div>
                <p className="mt-4 flex-1 text-sm leading-relaxed text-foreground/90">
                  “{t.content}”
                </p>
                <div className="mt-5 flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>{getInitials(t.name)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-semibold">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </div>
                </div>
              </motion.div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
