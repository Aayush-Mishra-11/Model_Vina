import { apiClient } from "@/lib/axios";
import type { ChatMessage, ConversationTopic } from "@/lib/types";

/**
 * AI Speaking Partner API.
 *  GET  /partner/topics
 *  GET  /partner/history
 *  POST /partner/message
 */

export interface PartnerMessagePayload {
  message: string;
  topicId?: string;
}

export interface PartnerTip {
  tip: string;
  count: number;
  example: string;
}

export interface PartnerMessageResponse extends ChatMessage {
  tips: string[];
  languageAlert?: boolean;
  detectedNonEnglishWords?: string[];
  turnCount?: number;
  difficultyLevel?: "easy" | "medium" | "hard";
  difficultyLabel?: string;
}


export interface PartnerSessionSummary {
  id: string;
  score: number;
  fluencyScore: number;
  fillerCount: number;
  fillerBreakdown: Record<string, number>;
  languageAlertsCount: number;
  grammarErrors: { original: string; tip: string }[];
  durationSeconds: number;
  totalWords: number;
  coachingTips: string[];
}

export const partnerApi = {
  getTopics: () =>
    apiClient.get<ConversationTopic[]>("/api/partner/topics").then((r) => r.data),

  getHistory: (topicId?: string) =>
    apiClient
      .get<ChatMessage[]>(`/api/partner/history${topicId ? `?topicId=${topicId}` : ""}`)
      .then((r) => r.data),

  sendMessage: (payload: PartnerMessagePayload) =>
    apiClient.post<PartnerMessageResponse>("/api/partner/message", payload).then((r) => r.data),

  getTips: () =>
    apiClient.get<PartnerTip[]>("/api/partner/tips").then((r) => r.data),

  stopSession: () =>
    apiClient.post<PartnerSessionSummary>("/api/partner/session/stop").then((r) => r.data),

  resetSession: () =>
    apiClient.post<{ status: string; greeting: string }>("/api/partner/session/reset").then((r) => r.data),
};

