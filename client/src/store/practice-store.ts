"use client";

import { create } from "zustand";

type PracticeStatus = "idle" | "listening" | "recording" | "paused" | "processing";

interface PracticeState {
  status: PracticeStatus;
  transcript: string;
  corrected: string;
  isEnglishOnly: boolean;
  confidence: number;
  pronunciation: number;
  speakingPace: number;
  elapsedSeconds: number;
  setStatus: (status: PracticeStatus) => void;
  setTranscript: (text: string) => void;
  setCorrected: (text: string) => void;
  setEnglishOnly: (value: boolean) => void;
  setMetrics: (metrics: Partial<Pick<PracticeState, "confidence" | "pronunciation" | "speakingPace">>) => void;
  tick: () => void;
  reset: () => void;
}

export const usePracticeStore = create<PracticeState>((set) => ({
  status: "idle",
  transcript: "",
  corrected: "",
  isEnglishOnly: true,
  confidence: 0,
  pronunciation: 0,
  speakingPace: 0,
  elapsedSeconds: 0,
  setStatus: (status) => set({ status }),
  setTranscript: (transcript) => set({ transcript }),
  setCorrected: (corrected) => set({ corrected }),
  setEnglishOnly: (isEnglishOnly) => set({ isEnglishOnly }),
  setMetrics: (metrics) => set(metrics),
  tick: () => set((s) => ({ elapsedSeconds: s.elapsedSeconds + 1 })),
  reset: () =>
    set({
      status: "idle",
      transcript: "",
      corrected: "",
      confidence: 0,
      pronunciation: 0,
      speakingPace: 0,
      elapsedSeconds: 0,
    }),
}));
