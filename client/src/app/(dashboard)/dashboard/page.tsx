"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  BookOpen,
  CheckCircle2,
  Flame,
  Gauge,
  Mic,
  MessagesSquare,
  Target,
  Trophy,
  Volume2,
  Wand2,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { MetricCard } from "@/components/dashboard/metric-card";
import { useApi } from "@/hooks/use-api";
import { dashboardApi } from "@/api/dashboard";
import { useAuthStore } from "@/store/auth-store";
import { formatDate } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const { data, isLoading, isError, refetch } = useApi(["dashboard"], dashboardApi.getSummary);

  return (
    <div className="space-y-8">
      {/* Vani AI Hero Banner */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl border border-primary/20 bg-card p-6 sm:p-8 shadow-card"
      >
        <div className="absolute -right-12 -top-12 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -left-12 -bottom-12 h-64 w-64 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1.5">
            <Badge variant="secondary" className="border-primary/40 text-primary px-3 py-1 font-semibold text-xs mb-1">
              ✨ Vani AI Speech Coach
            </Badge>
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
              Hello, {user?.name?.split(" ")[0] ?? "friend"}! 👋
            </h1>
            <p className="max-w-xl text-sm text-muted-foreground leading-relaxed">
              Build English fluency and speech confidence with Vani, your personal AI voice coach.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="gradient" size="lg" className="glow-peru" asChild>
              <Link href="/partner">
                <MessagesSquare className="h-5 w-5" /> Talk with Vani
              </Link>
            </Button>
          </div>
        </div>
      </motion.div>

      {isLoading && <DashboardSkeleton />}

      {isError && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center">
          <p className="text-sm text-muted-foreground">Couldn't load your dashboard.</p>
          <Button variant="outline" className="mt-3" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      )}

      {data && (
        <>
          {/* Metric cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <MetricCard label="Grammar" metric={data.grammarScore} icon={Wand2} suffix="%" />
            <MetricCard label="Confidence" metric={data.confidence} icon={Trophy} suffix="%" />
            <MetricCard label="Fluency" metric={data.fluency} icon={Gauge} suffix="%" />
            <MetricCard label="Pronunciation" metric={data.pronunciation} icon={Volume2} suffix="%" />
            <MetricCard label="Vocabulary" metric={data.vocabulary} icon={BookOpen} />
            <MetricCard label="Speaking pace" metric={data.speakingPace} icon={Gauge} suffix=" wpm" />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Streak + weekly goal */}
            <div className="space-y-6">
              <Card className="overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/20 text-primary glow-peru">
                      <Flame className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="font-display text-3xl font-bold">{data.currentStreak}</p>
                      <p className="text-xs text-muted-foreground font-medium">day streak</p>
                    </div>
                  </div>
                  <div className="mt-5">
                    <div className="mb-1.5 flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1.5 font-medium">
                        <Target className="h-4 w-4 text-primary" /> Weekly goal
                      </span>
                      <span className="text-muted-foreground">
                        {data.weeklyGoal.completed}/{data.weeklyGoal.total}
                      </span>
                    </div>
                    <Progress
                      value={(data.weeklyGoal.completed / data.weeklyGoal.total) * 100}
                      indicatorClassName="bg-gradient-to-r from-primary to-accent"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" /> Today's practice
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-display text-2xl font-bold">
                        {Math.floor(data.todayPracticeMinutes / 60)}h {data.todayPracticeMinutes % 60}m
                      </p>
                      <p className="text-xs text-muted-foreground">of {data.todayPracticeGoalMinutes}m goal</p>
                    </div>
                    <Progress
                      value={(data.todayPracticeMinutes / data.todayPracticeGoalMinutes) * 100}
                      className="w-24"
                    />
                  </div>
                  <Button variant="outline" className="mt-4 w-full" asChild>
                    <Link href="/challenge">Do daily challenge</Link>
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Recent sessions */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <CardTitle>Recent sessions</CardTitle>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/reports">View all</Link>
                  </Button>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.recentSessions.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      No practice sessions yet. Start your first session with Vani!
                    </p>
                  ) : (
                    data.recentSessions.map((s, i) => (
                      <motion.div
                        key={s.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="flex items-center gap-4 rounded-xl border bg-secondary/40 p-3.5 transition-colors hover:bg-secondary/70"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                          <Mic className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{s.title}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(s.createdAt)}</p>
                        </div>
                        <div className="text-right">
                          <Badge variant="success">{s.score}%</Badge>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {Math.floor(s.durationSeconds / 60)}m {s.durationSeconds % 60}s
                          </p>
                        </div>
                      </motion.div>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* Achievements */}
              <Card className="mt-6">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Achievements</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {data.achievements.map((a) => (
                      <div
                        key={a.id}
                        className={`flex flex-col items-center rounded-xl border p-3 text-center transition-all ${
                          a.unlocked ? "border-primary/40 bg-primary/10 shadow-sm" : "opacity-60"
                        }`}
                      >
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-full ${
                            a.unlocked ? "bg-primary text-primary-foreground glow-peru" : "bg-secondary text-muted-foreground"
                          }`}
                        >
                          {a.unlocked ? <Trophy className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
                        </div>
                        <p className="mt-2 text-xs font-semibold">{a.title}</p>
                        <Progress value={a.progress} className="mt-2 h-1" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-64" />
        <div className="lg:col-span-2 space-y-6">
          <Skeleton className="h-48" />
          <Skeleton className="h-40" />
        </div>
      </div>
    </div>
  );
}
