import { apiClient } from "@/lib/axios";
import type { VocabularyWord } from "@/lib/types";

/**
 * Vocabulary Builder API.
 *  GET /vocabulary/word-of-day
 *  GET /vocabulary/words
 *  POST /vocabulary/bookmark
 *  GET /vocabulary/bookmarks
 */

export const vocabularyApi = {
  wordOfDay: () =>
    apiClient.get<VocabularyWord>("/api/vocabulary/word-of-day").then((r) => r.data),

  list: (limit = 20) =>
    apiClient.get<VocabularyWord[]>(`/api/vocabulary/words?limit=${limit}`).then((r) => r.data),

  toggleBookmark: (wordId: string) =>
    apiClient
      .post<{ bookmarked: boolean }>("/api/vocabulary/bookmark", { wordId })
      .then((r) => r.data),

  bookmarks: () =>
    apiClient.get<VocabularyWord[]>("/api/vocabulary/bookmarks").then((r) => r.data),
};

export type { VocabularyWord };
