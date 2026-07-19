"use client";

import { useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "@/components/dashboard/section-header";
import { useApi } from "@/hooks/use-api";
import { analyticsApi, type AnalyticsRange } from "@/api/analytics";
import { TrendingUp, TrendingDown, Minus, Sparkles, Target } from "lucide-react";
import { cn } from "@/lib/utils";

const ranges: AnalyticsRange[] = ["week", "month", "year"];

const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--success))", "hsl(var(--warning))"];

export default function AnalyticsPage() {
  const [range, setRange] = useState<AnalyticsRange>("month");
  const { data, isLoading } = useApi(["analytics", range], () => analyticsApi.get(range));
  const { data: forecast } = useApi(
    ["analytics", "predict", 80],
    () => analyticsApi.predict(80),
  );

  const timeline = data?.timeline ?? [];
  const radar = data?.radar ?? [];
  const byCategory = data?.byCategory ?? [];
  const speakingSpeed = data?.speakingSpeed ?? [];
  const confidenceByWeek = data?.confidenceByWeek ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <SectionHeader title="Analytics" subtitle="Track every dimension of your speaking." />
        <div className="flex gap-1 rounded-xl bg-secondary p-1">
          {ranges.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={cn(
                "rounded-lg px-4 py-1.5 text-sm font-medium capitalize transition-colors",
                range === r ? "bg-background shadow-soft" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-72 animate-pulse rounded-2xl bg-secondary/50" />
          ))}
        </div>
      ) : (
        <>
          <ProgressForecastCard forecast={forecast} />
          <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Skills over time</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={timeline}>
                  <defs>
                    <linearGradient id="gGrammar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" fontSize={12} stroke="hsl(var(--muted-foreground))" />
                  <YAxis fontSize={12} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="grammar" stroke="hsl(var(--primary))" fill="url(#gGrammar)" />
                  <Area type="monotone" dataKey="pronunciation" stroke="hsl(var(--accent))" fillOpacity={0} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Skill radar</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <RadarChart data={radar}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="skill" fontSize={12} />
                  <Radar dataKey="score" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.4} />
                  <Tooltip contentStyle={tooltipStyle} />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">By category</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={byCategory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="category" fontSize={12} stroke="hsl(var(--muted-foreground))" />
                  <YAxis fontSize={12} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "hsl(var(--secondary))" }} />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    {byCategory.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Speaking speed (wpm)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={speakingSpeed}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" fontSize={12} stroke="hsl(var(--muted-foreground))" />
                  <YAxis fontSize={12} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="speakingSpeed" stroke="hsl(var(--success))" strokeWidth={2.5} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Confidence trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={confidenceByWeek}
                    dataKey="value"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    innerRadius={50}
                    paddingAngle={3}
                    label
                  >
                    {confidenceByWeek.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
        </>
      )}
    </div>
  );
}

function ProgressForecastCard({
  forecast,
}: {
  forecast: import("@/lib/types").ProgressForecast | undefined;
}) {
  if (!forecast) return null;

  const slope = forecast.slopePerSession;
  const TrendIcon = slope > 0.05 ? TrendingUp : slope < -0.05 ? TrendingDown : Minus;
  const trendColor =
    slope > 0.05
      ? "text-success"
      : slope < -0.05
        ? "text-destructive"
        : "text-muted-foreground";

  const confVariant: "default" | "secondary" | "outline" =
    forecast.confidence === "high"
      ? "default"
      : forecast.confidence === "medium"
        ? "secondary"
        : "outline";

  // Build a small chart series: current + projection.
  const series = [
    { label: "Now", score: forecast.currentScore, kind: "current" as const },
    ...forecast.projection.map((p) => ({
      label: `+${p.weeksAhead}w`,
      score: p.score,
      kind: "projection" as const,
    })),
  ];

  return (
    <Card className="overflow-hidden border-primary/30">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            Progress forecast
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">{forecast.summary}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant={confVariant} className="capitalize">
            {forecast.confidence === "insufficient-data"
              ? "Need more data"
              : `${forecast.confidence} confidence`}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {forecast.sessionsUsed} session{forecast.sessionsUsed === 1 ? "" : "s"} used
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 md:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Now</p>
            <p className="mt-1 text-3xl font-bold">
              {forecast.currentScore.toFixed(0)}
              <span className="ml-1 text-sm font-medium text-muted-foreground">/ 100</span>
            </p>
            <p className="text-sm text-muted-foreground">
              {forecast.currentCefr.level} — {forecast.currentCefr.label}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Next week
            </p>
            <p className="mt-1 text-3xl font-bold">
              {forecast.nextWeekScore.toFixed(0)}
              <span className="ml-1 text-sm font-medium text-muted-foreground">/ 100</span>
            </p>
            <p className={cn("flex items-center gap-1 text-sm", trendColor)}>
              <TrendIcon className="h-4 w-4" />
              {slope >= 0 ? "+" : ""}
              {slope.toFixed(2)} pts / session
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Target className="h-3 w-3" /> Target {forecast.targetCefr.level}
            </p>
            <p className="mt-1 text-3xl font-bold">
              {forecast.weeksToTarget === null
                ? "—"
                : forecast.weeksToTarget === 0
                  ? "Now"
                  : `${forecast.weeksToTarget}w`}
            </p>
            <p className="text-sm text-muted-foreground">
              {forecast.weeksToTarget === null
                ? "Keep practicing for an ETA"
                : forecast.weeksToTarget === 0
                  ? `Already at ${forecast.targetCefr.label}`
                  : `on track to ${forecast.targetCefr.label}`}
            </p>
          </div>
        </div>

        {forecast.projection.length > 0 && (
          <div className="mt-6 h-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series}>
                <defs>
                  <linearGradient id="gForecast" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                <YAxis domain={[0, 100]} fontSize={11} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={tooltipStyle} />
                <Area
                  type="monotone"
                  dataKey="score"
                  stroke="hsl(var(--primary))"
                  fill="url(#gForecast)"
                  strokeWidth={2.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const tooltipStyle = {
  background: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "0.75rem",
  fontSize: "0.8rem",
  color: "hsl(var(--popover-foreground))",
};
