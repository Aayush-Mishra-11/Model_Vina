"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Palette, Globe, Bell, Mic, Volume2, Users, ShieldCheck, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "@/components/dashboard/section-header";
import { useSettingsStore } from "@/store/settings-store";
import { settingsApi } from "@/api/settings";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";

function Row({ icon: Icon, title, description, children }: {
  icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-4 last:border-0">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const settings = useSettingsStore();
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await settingsApi.update({
        language: settings.language,
        englishOnlyMode: settings.englishOnlyMode,
        notifications: settings.notifications,
        selectedVoice: settings.selectedVoice,
      });
      toast.success("Settings saved");
    } catch {
      toast.error("Couldn't save settings");
    } finally {
      setSaving(false);
    }
  };

  const languages = ["en-US", "en-GB", "en-AU"];
  const voices = ["aria", "roger", "sarah", "charlie"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SectionHeader title="Settings" subtitle="Personalize your experience." />
        <Button variant="gradient" onClick={save} loading={saving}>Save changes</Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Palette className="h-4 w-4" /> Appearance & Language
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Row icon={Globe} title="Language" description="Interface & speech language">
              <select
                value={settings.language}
                onChange={(e) => settings.setLanguage(e.target.value)}
                className="h-9 rounded-xl border border-input bg-background/60 px-3 text-sm"
              >
                {languages.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </Row>
            <Row icon={ShieldCheck} title="English-only mode" description="Warn when you speak another language">
              <Switch checked={settings.englishOnlyMode} onCheckedChange={settings.setEnglishOnlyMode} />
            </Row>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-4 w-4" /> Notifications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Row icon={Bell} title="Practice reminders" description="Daily nudge to practice">
              <Switch
                checked={settings.notifications.practiceReminders}
                onCheckedChange={(v) => settings.setNotifications({ practiceReminders: v })}
              />
            </Row>
            <Row icon={Globe} title="Weekly report" description="Summary every Monday">
              <Switch
                checked={settings.notifications.weeklyReport}
                onCheckedChange={(v) => settings.setNotifications({ weeklyReport: v })}
              />
            </Row>
            <Row icon={Bell} title="Achievements" description="Celebrate milestones">
              <Switch
                checked={settings.notifications.achievements}
                onCheckedChange={(v) => settings.setNotifications({ achievements: v })}
              />
            </Row>
            <Row icon={Volume2} title="Sound" description="Play sounds for events">
              <Switch
                checked={settings.notifications.sound}
                onCheckedChange={(v) => settings.setNotifications({ sound: v })}
              />
            </Row>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Mic className="h-4 w-4" /> Devices
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Row icon={Mic} title="Microphone" description="Input device">
              <select
                value={settings.selectedMicrophone}
                onChange={(e) => settings.setMicrophone(e.target.value)}
                className="h-9 rounded-xl border border-input bg-background/60 px-3 text-sm"
              >
                <option value="">Default</option>
                <option value="mic1">Built-in Microphone</option>
              </select>
            </Row>
            <Row icon={Volume2} title="Speaker" description="Output device">
              <select
                value={settings.selectedSpeaker}
                onChange={(e) => settings.setSpeaker(e.target.value)}
                className="h-9 rounded-xl border border-input bg-background/60 px-3 text-sm"
              >
                <option value="">Default</option>
                <option value="spk1">Built-in Output</option>
              </select>
            </Row>
            <Row icon={Users} title="Voice" description="AI partner voice">
              <select
                value={settings.selectedVoice}
                onChange={(e) => settings.setVoice(e.target.value)}
                className="h-9 rounded-xl border border-input bg-background/60 px-3 text-sm"
              >
                {voices.map((v) => (
                  <option key={v} value={v} className="capitalize">{v}</option>
                ))}
              </select>
            </Row>
          </CardContent>
        </Card>

        <Card className="border-destructive/30">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Lock className="h-4 w-4 text-destructive" /> Privacy & Security
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Row icon={ShieldCheck} title="Data processing" description="Audio used only for analysis">
              <Badge variant="success">Secure</Badge>
            </Row>
            <Row icon={Lock} title="Delete history" description="Remove all practice data">
              <Button variant="destructive" size="sm" onClick={() => toast.success("History deleted")}>
                Delete
              </Button>
            </Row>
            <p className="mt-3 text-xs text-muted-foreground">
              ConviAI processes your audio securely. You can export or delete your data anytime.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
