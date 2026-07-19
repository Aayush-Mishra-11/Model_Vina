"use client";

import { create } from "zustand";
import type { DashboardSummary } from "@/lib/types";

interface DashboardState {
  summary: DashboardSummary | null;
  setSummary: (summary: DashboardSummary) => void;
  reset: () => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  summary: null,
  setSummary: (summary) => set({ summary }),
  reset: () => set({ summary: null }),
}));
