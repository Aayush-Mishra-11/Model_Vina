"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Award, Edit3, Flame, Clock, Trophy, BookOpen, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "@/components/dashboard/section-header";
import { useApi } from "@/hooks/use-api";
import { profileApi } from "@/api/profile";
import { useAuthStore } from "@/store/auth-store";
import { getInitials, formatDate } from "@/lib/utils";
import { EditProfileDialog } from "@/components/profile/edit-profile-dialog";
import { demoUser } from "@/lib/mock";

export default function ProfilePage() {
  const authUser = useAuthStore((s) => s.user);
  // In demo mode there is no logged-in user; fall back to the demo identity
  // so the page is fully clickable without a backend.
  const user = authUser ?? demoUser;
  const [editOpen, setEditOpen] = useState(false);
  const { data: stats } = useApi(["profile-stats"], profileApi.stats);
  const { data: certs } = useApi(["certificates"], profileApi.certificates);

  const statCards = [
    { icon: Mic, label: "Sessions", value: stats?.totalSessions ?? 0 },
    { icon: Clock, label: "Minutes", value: stats?.totalMinutes ?? 0 },
    { icon: Trophy, label: "Avg score", value: stats?.averageScore ?? 0 },
    { icon: Flame, label: "Best streak", value: stats?.longestStreak ?? 0 },
    { icon: BookOpen, label: "Words", value: stats?.wordsLearned ?? 0 },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader title="Profile" subtitle="Your achievements, certificates, and history." />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardContent className="flex flex-col items-center p-6 text-center">
            <Avatar className="h-24 w-24">
              {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
              <AvatarFallback className="text-2xl">{user ? getInitials(user.name) : "U"}</AvatarFallback>
            </Avatar>
            <h2 className="mt-4 font-display text-xl font-bold">{user?.name}</h2>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
            <Badge variant="gradient" className="mt-3 bg-primary/15 text-primary capitalize">
              {user?.plan ?? "free"} plan
            </Badge>
            <Button variant="outline" className="mt-5 w-full" onClick={() => setEditOpen(true)}>
              <Edit3 className="h-4 w-4" /> Edit profile
            </Button>
          </CardContent>
        </Card>

        <EditProfileDialog open={editOpen} onOpenChange={setEditOpen} user={user!} />

        <div className="space-y-6 lg:col-span-2">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {statCards.map((s) => (
              <motion.div key={s.label} whileHover={{ y: -3 }}>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <s.icon className="h-4 w-4" />
                    </div>
                    <p className="mt-2 font-display text-2xl font-bold">{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Award className="h-4 w-4 text-warning" /> Certificates
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(certs ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No certificates yet. Keep practicing to earn them!</p>
              ) : (
                certs!.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 rounded-xl border bg-secondary/30 p-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/15 text-warning">
                      <Award className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{c.title}</p>
                      <p className="text-xs text-muted-foreground">Issued {formatDate(c.issuedAt)}</p>
                    </div>
                    <Badge variant="success">{c.score}%</Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Practice history</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-xl border bg-secondary/30 p-3 text-center">
                <p className="font-display text-lg font-bold">{90 - i * 3}%</p>
                <p className="text-xs text-muted-foreground">Session {i + 1}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
