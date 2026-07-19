/**
 * Shared domain types used across the app.
 * These mirror the expected REST API response/request shapes.
 */

/* ----------------------------- Auth ----------------------------- */

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  plan: "free" | "pro" | "enterprise";
  createdAt: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

/* --------------------------- Dashboard --------------------------- */

export interface Metric {
  label: string;
  value: number;
  unit?: string;
  change: number; // percentage change vs previous period
  trend: "up" | "down" | "flat";
}

export interface DashboardSummary {
  todayPracticeMinutes: number;
  todayPracticeGoalMinutes: number;
  grammarScore: Metric;
  confidence: Metric;
  fluency: Metric;
  pronunciation: Metric;
  vocabulary: Metric;
  speakingPace: Metric;
  currentStreak: number;
  weeklyGoal: { completed: number; total: number };
  achievements: Achievement[];
  recentSessions: PracticeSession[];
}

export interface PracticeSession {
  id: string;
  type: PracticeType;
  title: string;
  durationSeconds: number;
  score: number;
  createdAt: string;
}

export type PracticeType =
  | "free_practice"
  | "speaking_partner"
  | "mock_interview"
  | "daily_challenge";

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  progress: number; // 0-100
}

/* -------------------------- Practice -------------------------- */

export interface PracticeResult {
  id: string;
  transcript: string;
  corrected: string;
  grammarErrors: GrammarError[];
  vocabularySuggestions: VocabularySuggestion[];
  confidenceScore: number;
  pronunciationScore: number;
  speakingPaceWpm: number;
  englishOnlyViolation: boolean;
  /** Server-side flag: true if the score came from a real phoneme model. */
  pronunciationAvailable?: boolean;
}

export interface GrammarError {
  id: string;
  message: string;
  category: "grammar" | "spelling" | "punctuation" | "style";
  start: number;
  end: number;
  suggestion: string;
}

export interface VocabularySuggestion {
  word: string;
  meaning: string;
  alternatives: string[];
}

/* ----------------------- AI Correction ----------------------- */

export interface CorrectionResult {
  id: string;
  original: string;
  corrected: string;
  improved: string;
  professional: string;
  grammarErrors: GrammarError[];
  vocabularySuggestions: VocabularySuggestion[];
}

/* ---------------------- Speaking Partner ---------------------- */

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface ConversationTopic {
  id: string;
  label: string;
  emoji: string;
}

/* ----------------------- Mock Interview ----------------------- */

export interface InterviewConfig {
  company: string;
  role: string;
  difficulty: "easy" | "medium" | "hard";
}

export interface InterviewQuestion {
  id: string;
  question: string;
  category: string;
}

export interface InterviewFeedback {
  id: string;
  questionId: string;
  transcript: string;
  grammarScore: number;
  clarityScore: number;
  confidenceScore: number;
  feedback: string;
  tips: string[];
}

export interface InterviewSummary {
  id: string;
  totalScore: number;
  questionsAnswered: number;
  feedback: InterviewFeedback[];
}

/* --------------------- Vocabulary Builder --------------------- */

export interface VocabularyWord {
  id: string;
  word: string;
  phonetic: string;
  meaning: string;
  synonyms: string[];
  antonyms: string[];
  examples: string[];
  bookmarked: boolean;
}

/* ----------------------- Daily Challenge ----------------------- */

export interface DailyChallenge {
  id: string;
  type: "storytelling" | "picture_description" | "debate" | "random";
  title: string;
  prompt: string;
  imageUrl?: string;
  reward: string;
  completed: boolean;
}

/* ------------------------- Analytics ------------------------- */

export interface AnalyticsSeriesPoint {
  label: string;
  grammar: number;
  confidence: number;
  pronunciation: number;
  vocabulary: number;
  fluency: number;
  speakingSpeed: number;
}

export interface AnalyticsBreakdown {
  category: string;
  value: number;
}

export interface AnalyticsSummary {
  timeline: AnalyticsSeriesPoint[];
  radar: { skill: string; score: number }[];
  byCategory: AnalyticsBreakdown[];
  speakingSpeed: AnalyticsSeriesPoint[];
  confidenceByWeek: AnalyticsBreakdown[];
}

/* --------------------------- Reports --------------------------- */

export interface ReportItem {
  id: string;
  date: string;
  durationSeconds: number;
  type: PracticeType;
  score: number;
  grammar: number;
  pronunciation: number;
  fluency: number;
}

/* --------------------------- Profile --------------------------- */

export interface Certificate {
  id: string;
  title: string;
  issuedAt: string;
  score: number;
}

export interface ProfileStats {
  totalSessions: number;
  totalMinutes: number;
  averageScore: number;
  longestStreak: number;
  wordsLearned: number;
}

/* --------------------------- Settings --------------------------- */

export interface NotificationSettings {
  practiceReminders: boolean;
  weeklyReport: boolean;
  achievements: boolean;
  sound: boolean;
}

/* ------------------------- Progress forecast ------------------------- */

export type CefrLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

export interface CefrInfo {
  level: CefrLevel;
  label: string;
}

export interface ProgressProjectionPoint {
  weeksAhead: number;
  score: number;
  cefr: CefrInfo;
}

export interface ProgressForecast {
  currentScore: number;
  currentCefr: CefrInfo;
  nextWeekScore: number;
  nextWeekCefr: CefrInfo;
  targetScore: number;
  targetCefr: CefrInfo;
  weeksToTarget: number | null;
  slopePerSession: number;
  confidence: "low" | "medium" | "high" | "insufficient-data";
  sessionsUsed: number;
  projection: ProgressProjectionPoint[];
  summary: string;
}

