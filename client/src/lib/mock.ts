import type {
  User,
  DashboardSummary,
  PracticeSession,
  VocabularyWord,
  ConversationTopic,
  ChatMessage,
  AnalyticsSummary,
  ReportItem,
  Certificate,
  ProfileStats,
  CorrectionResult,
  AuthResponse,
} from "./types";

/**
 * Demo / offline mode mock data.
 *
 * When NEXT_PUBLIC_DEMO_MODE is "true", the axios client short-circuits every
 * request and returns these fixtures instead of hitting the (placeholder) backend.
 * This lets the entire UI be clicked through with no backend. It does NOT replace
 * your real API — flip the env flag off (or delete it) once your backend is live.
 */

const delay = (ms = 320) => new Promise((r) => setTimeout(r, ms));

export const demoUser: User = {
  id: "u_demo",
  name: "Demo User",
  email: "demo@conviai.app",
  plan: "pro",
  createdAt: new Date().toISOString(),
};

export const loginMock = (): AuthResponse => ({
  user: demoUser,
  token: "demo-token-000",
});

export const dashboardSummaryMock: DashboardSummary = {
  todayPracticeMinutes: 18,
  todayPracticeGoalMinutes: 30,
  grammarScore: { label: "Grammar", value: 86, unit: "%", change: 4.2, trend: "up" },
  confidence: { label: "Confidence", value: 82, unit: "%", change: 6.1, trend: "up" },
  fluency: { label: "Fluency", value: 78, unit: "%", change: 2.4, trend: "up" },
  pronunciation: { label: "Pronunciation", value: 88, unit: "%", change: -1.2, trend: "down" },
  vocabulary: { label: "Vocabulary", value: 64, unit: "", change: 8.0, trend: "up" },
  speakingPace: { label: "Speaking pace", value: 132, unit: " wpm", change: 3.0, trend: "up" },
  currentStreak: 14,
  weeklyGoal: { completed: 4, total: 7 },
  achievements: [
    { id: "a1", title: "First Words", description: "Complete your first session", icon: "spark", unlocked: true, progress: 100 },
    { id: "a2", title: "Week Warrior", description: "7-day streak", icon: "flame", unlocked: true, progress: 100 },
    { id: "a3", title: "Grammar Guru", description: "90%+ grammar score", icon: "wand", unlocked: false, progress: 72 },
    { id: "a4", title: "Chatterbox", description: "20 sessions", icon: "mic", unlocked: false, progress: 55 },
  ],
  recentSessions: [
    { id: "s1", type: "free_practice", title: "Free Practice", durationSeconds: 240, score: 88, createdAt: new Date(Date.now() - 3600_000).toISOString() },
    { id: "s2", type: "mock_interview", title: "Google Interview", durationSeconds: 600, score: 83, createdAt: new Date(Date.now() - 86_400_000).toISOString() },
    { id: "s3", type: "daily_challenge", title: "Daily Challenge", durationSeconds: 95, score: 91, createdAt: new Date(Date.now() - 172_800_000).toISOString() },
  ],
};

export const sessionsMock: PracticeSession[] = dashboardSummaryMock.recentSessions;

export const vocabWordMock: VocabularyWord = {
  id: "v_eloquent",
  word: "Eloquent",
  phonetic: "/ˈeləkwənt/",
  meaning: "Fluent and persuasive in speaking or writing.",
  synonyms: ["articulate", "expressive", "well-spoken"],
  antonyms: ["inarticulate", "mumbled"],
  examples: ["She gave an eloquent speech that moved the room."],
  bookmarked: false,
};

export const topicsMock: ConversationTopic[] = [
  { id: "t1", label: "Travel", emoji: "✈️" },
  { id: "t2", label: "Technology", emoji: "💡" },
  { id: "t3", label: "Food", emoji: "🍜" },
  { id: "t4", label: "Movies", emoji: "🎬" },
  { id: "t5", label: "Career", emoji: "💼" },
];

export const historyMock: ChatMessage[] = [
  { id: "m1", role: "assistant", content: "Hi! I'm your AI speaking partner. What would you like to talk about today?", createdAt: new Date(Date.now() - 120_000).toISOString() },
  { id: "m2", role: "user", content: "Let's talk about travel.", createdAt: new Date(Date.now() - 90_000).toISOString() },
];

export const partnerReplyMock = (msg: string): ChatMessage => ({
  id: `m_${Date.now()}`,
  role: "assistant",
  content: `That's interesting! Tell me more about "${msg.slice(0, 40)}…" — what did you enjoy most about it?`,
  createdAt: new Date().toISOString(),
});

export const analyticsMock: AnalyticsSummary = {
  timeline: [
    { label: "Mon", grammar: 70, confidence: 65, pronunciation: 72, vocabulary: 50, fluency: 60, speakingSpeed: 120 },
    { label: "Tue", grammar: 74, confidence: 68, pronunciation: 75, vocabulary: 54, fluency: 63, speakingSpeed: 124 },
    { label: "Wed", grammar: 78, confidence: 72, pronunciation: 79, vocabulary: 58, fluency: 66, speakingSpeed: 128 },
    { label: "Thu", grammar: 80, confidence: 76, pronunciation: 82, vocabulary: 60, fluency: 70, speakingSpeed: 130 },
    { label: "Fri", grammar: 83, confidence: 79, pronunciation: 85, vocabulary: 62, fluency: 74, speakingSpeed: 131 },
    { label: "Sat", grammar: 85, confidence: 81, pronunciation: 87, vocabulary: 63, fluency: 77, speakingSpeed: 133 },
    { label: "Sun", grammar: 86, confidence: 82, pronunciation: 88, vocabulary: 64, fluency: 78, speakingSpeed: 132 },
  ],
  radar: [
    { skill: "Grammar", score: 86 },
    { skill: "Confidence", score: 82 },
    { skill: "Pronunciation", score: 88 },
    { skill: "Vocabulary", score: 64 },
    { skill: "Fluency", score: 78 },
    { skill: "Pace", score: 75 },
  ],
  byCategory: [
    { category: "Grammar", value: 86 },
    { category: "Pronunciation", value: 88 },
    { category: "Fluency", value: 78 },
    { category: "Vocabulary", value: 64 },
  ],
  speakingSpeed: [
    { label: "W1", grammar: 0, confidence: 0, pronunciation: 0, vocabulary: 0, fluency: 0, speakingSpeed: 118 },
    { label: "W2", grammar: 0, confidence: 0, pronunciation: 0, vocabulary: 0, fluency: 0, speakingSpeed: 125 },
    { label: "W3", grammar: 0, confidence: 0, pronunciation: 0, vocabulary: 0, fluency: 0, speakingSpeed: 128 },
    { label: "W4", grammar: 0, confidence: 0, pronunciation: 0, vocabulary: 0, fluency: 0, speakingSpeed: 132 },
  ],
  confidenceByWeek: [
    { category: "Week 1", value: 65 },
    { category: "Week 2", value: 72 },
    { category: "Week 3", value: 78 },
    { category: "Week 4", value: 82 },
  ],
};

export const reportsMock: ReportItem[] = [
  { id: "r1", date: new Date(Date.now() - 86400_000).toISOString(), durationSeconds: 240, type: "free_practice", score: 88, grammar: 86, pronunciation: 88, fluency: 78 },
  { id: "r2", date: new Date(Date.now() - 172800_000).toISOString(), durationSeconds: 600, type: "mock_interview", score: 83, grammar: 80, pronunciation: 84, fluency: 79 },
  { id: "r3", date: new Date(Date.now() - 259200_000).toISOString(), durationSeconds: 95, type: "daily_challenge", score: 91, grammar: 90, pronunciation: 89, fluency: 82 },
  { id: "r4", date: new Date(Date.now() - 345600_000).toISOString(), durationSeconds: 310, type: "speaking_partner", score: 85, grammar: 84, pronunciation: 86, fluency: 80 },
];

export const certificatesMock: Certificate[] = [
  { id: "c1", title: "Communication Foundations", issuedAt: new Date(Date.now() - 2.6e9).toISOString(), score: 88 },
  { id: "c2", title: "Interview Ready", issuedAt: new Date(Date.now() - 1.2e9).toISOString(), score: 83 },
];

export const profileStatsMock: ProfileStats = {
  totalSessions: 42,
  totalMinutes: 540,
  averageScore: 84,
  longestStreak: 21,
  wordsLearned: 128,
};

export const correctionMock = (text: string): CorrectionResult => ({
  id: "corr_demo",
  original: text,
  corrected: text.replace(/\s+/g, " ").trim() + (text.trim().endsWith(".") ? "" : "."),
  improved: "I would express this more naturally: " + text.trim().replace(/^i\b/i, "I") + ".",
  professional: "Thank you for the update. " + text.trim().replace(/^i\b/i, "I") + ".",
  grammarErrors: [
    { id: "e1", message: "Consider adding a period at the end of the sentence.", category: "punctuation", start: 0, end: 1, suggestion: "Add '.'" },
  ],
  vocabularySuggestions: [
    { word: "good", meaning: "A basic positive adjective.", alternatives: ["excellent", "solid", "impressive"] },
  ],
});

/** Resolve any request to a mock payload based on method + path. */
export async function mockResponder(
  url: string,
  method: string,
  body?: unknown,
): Promise<unknown> {
  await delay();
  const path = url.split("?")[0];
  const m = method.toLowerCase();

  if (path.startsWith("/auth/login") || path.startsWith("/auth/register") || path.startsWith("/auth/verify"))
    return loginMock();
  if (path.startsWith("/auth/me")) return demoUser;
  if (path.startsWith("/auth/forgot-password") || path.startsWith("/auth/reset-password"))
    return { message: "ok" };

  if (path === "/dashboard") return dashboardSummaryMock;
  if (path === "/dashboard/sessions") return sessionsMock;

  if (path === "/correction") {
    const text = (body as { text?: string })?.text ?? "I think the meeting will start at nine o'clock.";
    return correctionMock(text);
  }
  if (path === "/vocabulary/word-of-day") return vocabWordMock;
  if (path === "/vocabulary/words") return [vocabWordMock];
  if (path === "/vocabulary/bookmarks") return [vocabWordMock];

  if (path === "/partner/topics") return topicsMock;
  if (path === "/partner/history") return historyMock;
  if (path === "/partner/message") {
    const msg = (body as { message?: string })?.message ?? "";
    return partnerReplyMock(msg);
  }

  if (path === "/interview/questions")
    return [
      { id: "q1", question: "Tell me about yourself.", category: "Introduction" },
      { id: "q2", question: "Describe a challenge you overcame.", category: "Behavioral" },
    ];
  if (path.startsWith("/interview/summary/"))
    return { id: "iv1", totalScore: 83, questionsAnswered: 2, feedback: [] };
  if (path === "/interview/start") return { interviewId: "iv1" };

  if (path === "/challenge/today")
    return { id: "c1", type: "storytelling", title: "Storytelling", prompt: "Tell a 60-second story about a fear you overcame.", reward: "+20 XP", completed: false };
  if (path === "/challenge/history") return [];

  if (path === "/analytics") return analyticsMock;

  if (path === "/reports") return reportsMock;
  if (path.startsWith("/reports/export")) return new Blob(["demo report"], { type: "text/plain" });

  if (path === "/profile" && m === "put") {
    const payload = (body as { name?: string; email?: string }) ?? {};
    return {
      ...demoUser,
      ...(payload.name ? { name: payload.name } : {}),
      ...(payload.email ? { email: payload.email } : {}),
    };
  }
  if (path === "/profile") return demoUser;
  if (path === "/profile/certificates") return certificatesMock;
  if (path === "/profile/stats") return profileStatsMock;

  if (path === "/settings") return { language: "en-US", notifications: { practiceReminders: true, weeklyReport: true, achievements: true, sound: true }, englishOnlyMode: true, selectedVoice: "aria" };

  // Default fallback
  return { ok: true };
}
