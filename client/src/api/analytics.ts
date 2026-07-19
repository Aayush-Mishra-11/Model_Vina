import { apiClient } from "@/lib/axios";
import type { AnalyticsSummary, ProgressForecast } from "@/lib/types";

/**
 * Analytics API.
 *  GET /analytics
 *  GET /analytics?range=week|month|year
 *  GET /analytics/predict?targetScore=80
 */

export type AnalyticsRange = "week" | "month" | "year";

export const analyticsApi = {
  get: (range: AnalyticsRange = "month") =>
    apiClient
      .get<AnalyticsSummary>(`/api/analytics?range=${range}`)
      .then((r) => r.data),

  predict: (targetScore: number = 80) =>
    apiClient
      .get<ProgressForecast>(`/api/analytics/predict?targetScore=${targetScore}`)
      .then((r) => r.data),
};

export type { AnalyticsSummary, ProgressForecast };
