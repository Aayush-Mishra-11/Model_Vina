"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FadeIn } from "@/components/page-transition";
import { cn } from "@/lib/utils";

interface Plan {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  cta: string;
  highlight?: boolean;
}

const plans: Plan[] = [
  {
    name: "Free",
    price: "$0",
    period: "/mo",
    description: "Perfect for getting started.",
    features: [
      "5 minutes of practice per day",
      "Basic grammar correction",
      "Daily challenge",
      "Vocabulary word of the day",
    ],
    cta: "Get started",
  },
  {
    name: "Pro",
    price: "$12",
    period: "/mo",
    description: "For serious learners.",
    features: [
      "Unlimited practice time",
      "AI speaking partner",
      "Mock interviews with scoring",
      "Full analytics & reports",
      "Pronunciation analysis",
      "Priority AI models",
    ],
    cta: "Start Pro trial",
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "For teams & institutions.",
    features: [
      "Everything in Pro",
      "Team analytics dashboard",
      "Admin dashboard",
      "SSO & compliance",
      "Dedicated support",
    ],
    cta: "Contact sales",
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="relative scroll-mt-24 py-24">
      <div className="container">
        <FadeIn className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-semibold uppercase tracking-wider text-primary">
            Pricing
          </span>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Simple, honest pricing
          </h2>
          <p className="mt-4 text-muted-foreground">
            Start free. Upgrade when you're ready to accelerate.
          </p>
        </FadeIn>

        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {plans.map((plan, i) => (
            <FadeIn key={plan.name} delay={i * 0.08}>
              <motion.div
                whileHover={{ y: -6 }}
                className={cn(
                  "relative flex h-full flex-col rounded-3xl border p-7 shadow-card transition-shadow",
                  plan.highlight
                    ? "border-primary/40 bg-card shadow-glow lg:-mt-4 lg:mb-4"
                    : "bg-card",
                )}
              >
                {plan.highlight && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                    Most popular
                  </Badge>
                )}
                <h3 className="font-display text-xl font-semibold">{plan.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
                <div className="mt-5 flex items-end gap-1">
                  <span className="font-display text-4xl font-bold">{plan.price}</span>
                  <span className="pb-1 text-sm text-muted-foreground">{plan.period}</span>
                </div>
                <ul className="mt-6 flex-1 space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="mt-7 w-full"
                  variant={plan.highlight ? "gradient" : "outline"}
                  asChild
                >
                  <Link href="/signup">{plan.cta}</Link>
                </Button>
              </motion.div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
