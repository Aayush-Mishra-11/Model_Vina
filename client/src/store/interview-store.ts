"use client";

import { create } from "zustand";
import type { InterviewConfig, InterviewQuestion, InterviewFeedback } from "@/lib/types";

interface InterviewState {
  config: InterviewConfig | null;
  questions: InterviewQuestion[];
  currentIndex: number;
  answers: Record<string, string>;
  feedback: InterviewFeedback[];
  totalScore: number | null;
  setConfig: (config: InterviewConfig) => void;
  setQuestions: (questions: InterviewQuestion[]) => void;
  setAnswer: (questionId: string, transcript: string) => void;
  setFeedback: (feedback: InterviewFeedback[]) => void;
  setTotalScore: (score: number | null) => void;
  next: () => void;
  prev: () => void;
  reset: () => void;
}

export const useInterviewStore = create<InterviewState>((set) => ({
  config: null,
  questions: [],
  currentIndex: 0,
  answers: {},
  feedback: [],
  totalScore: null,
  setConfig: (config) => set({ config }),
  setQuestions: (questions) => set({ questions }),
  setAnswer: (questionId, transcript) =>
    set((s) => ({ answers: { ...s.answers, [questionId]: transcript } })),
  setFeedback: (feedback) => set({ feedback }),
  setTotalScore: (totalScore) => set({ totalScore }),
  next: () => set((s) => ({ currentIndex: Math.min(s.currentIndex + 1, s.questions.length - 1) })),
  prev: () => set((s) => ({ currentIndex: Math.max(s.currentIndex - 1, 0) })),
  reset: () =>
    set({
      config: null,
      questions: [],
      currentIndex: 0,
      answers: {},
      feedback: [],
      totalScore: null,
    }),
}));
