import { apiClient } from "@/lib/axios";
import type { DailyChallenge } from "@/lib/types";

/**
 * Daily Challenge API.
 *  GET    /challenge/today
 *  POST   /challenge/complete
 *  GET    /challenge/history
 */

export const challengeApi = {
  today: () =>
    apiClient.get<DailyChallenge>("/api/challenge/today").then((r) => r.data),

  list: () =>
    apiClient.get<DailyChallenge[]>("/api/challenge/history").then((r) => r.data),

  complete: (payload: { challengeId: string; audio: FormData }) =>
    apiClient
      .post<{ score: number; reward: string }>("/api/challenge/complete", payload.audio, {
        params: { challengeId: payload.challengeId },
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data),
};

export type { DailyChallenge };
