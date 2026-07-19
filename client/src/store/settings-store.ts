"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { NotificationSettings } from "@/lib/types";

interface SettingsState {
  language: string;
  notifications: NotificationSettings;
  selectedMicrophone: string;
  selectedSpeaker: string;
  selectedVoice: string;
  englishOnlyMode: boolean;
  setLanguage: (language: string) => void;
  setNotifications: (notifications: Partial<NotificationSettings>) => void;
  setMicrophone: (id: string) => void;
  setSpeaker: (id: string) => void;
  setVoice: (id: string) => void;
  setEnglishOnlyMode: (value: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      language: "en-US",
      notifications: {
        practiceReminders: true,
        weeklyReport: true,
        achievements: true,
        sound: true,
      },
      selectedMicrophone: "",
      selectedSpeaker: "",
      selectedVoice: "aria",
      englishOnlyMode: true,
      setLanguage: (language) => set({ language }),
      setNotifications: (notifications) =>
        set((s) => ({ notifications: { ...s.notifications, ...notifications } })),
      setMicrophone: (selectedMicrophone) => set({ selectedMicrophone }),
      setSpeaker: (selectedSpeaker) => set({ selectedSpeaker }),
      setVoice: (selectedVoice) => set({ selectedVoice }),
      setEnglishOnlyMode: (englishOnlyMode) => set({ englishOnlyMode }),
    }),
    { name: "conviai.settings" },
  ),
);
