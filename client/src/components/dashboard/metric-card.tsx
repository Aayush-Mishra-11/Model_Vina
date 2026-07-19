"use client";

import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Counter } from "@/components/counter";
import { cn } from "@/lib/utils";
import type { Metric } from "@/lib/types";

interface MetricCardProps {
  label: string;
  metric: Metric;
  icon: LucideIcon;
  suffix?: string;
  decimals?: number;
}

export function MetricCard({ label, metric, icon: Icon, suffix = "", decimals = 0 }: MetricCardProps) {
  const TrendIcon =
    metric.trend === "up" ? ArrowUpRight : metric.trend === "down" ? ArrowDownRight : Minus;
  const trendColor =
    metric.trend === "up"
      ? "text-success"
      : metric.trend === "down"
        ? "text-destructive"
        : "text-muted-foreground";

  return (
    <motion.div whileHover={{ y: -4 }} transition={{ type: "spring", stiffness: 300, damping: 22 }}>
      <Card className="relative overflow-hidden p-5">
        <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-primary/5" />
        <div className="flex items-center justify-between">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <span className={cn("flex items-center gap-0.5 text-xs font-medium", trendColor)}>
            <TrendIcon className="h-3.5 w-3.5" />
            {metric.change > 0 ? "+" : ""}
            {metric.change}%
          </span>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">{label}</p>
        <p className="font-display text-3xl font-bold tracking-tight">
          <Counter to={metric.value} decimals={decimals} suffix={suffix} />
        </p>
        <Progress value={Math.min(100, metric.value)} className="mt-3 h-1.5" />
      </Card>
    </motion.div>
  );
}
