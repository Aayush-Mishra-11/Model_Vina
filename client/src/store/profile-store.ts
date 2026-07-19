"use client";

import { create } from "zustand";
import type { Certificate, ProfileStats } from "@/lib/types";

interface ProfileState {
  certificates: Certificate[];
  stats: ProfileStats | null;
  setCertificates: (certificates: Certificate[]) => void;
  setStats: (stats: ProfileStats) => void;
}

export const useProfileStore = create<ProfileState>((set) => ({
  certificates: [],
  stats: null,
  setCertificates: (certificates) => set({ certificates }),
  setStats: (stats) => set({ stats }),
}));
