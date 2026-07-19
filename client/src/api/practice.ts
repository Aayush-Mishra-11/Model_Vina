import { apiClient } from "@/lib/axios";
import type {
  PracticeResult,
  GrammarError,
  VocabularySuggestion,
} from "@/lib/types";

/**
 * Practice / Speech API.
 *  POST /practice/start
 *  POST /practice/stop
 *  POST /speech/analyze
 */

export interface PracticeStartPayload {
  type: "free_practice" | "speaking_partner" | "mock_interview";
}

export const practiceApi = {
  start: (payload: PracticeStartPayload) =>
    apiClient.post<{ sessionId: string }>("/api/practice/start", payload).then((r) => r.data),

  stop: (sessionId: string) =>
    apiClient.post<PracticeResult>(`/api/practice/stop`, { sessionId }).then((r) => r.data),

  analyze: (audioRef: FormData) =>
    apiClient
      .post<PracticeResult>("/api/speech/analyze", audioRef, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data),
};

export type { PracticeResult, GrammarError, VocabularySuggestion };

