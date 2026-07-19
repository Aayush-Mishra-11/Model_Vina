import { apiClient } from "@/lib/axios";
import type { DashboardSummary, PracticeSession } from "@/lib/types";

/**
 * Dashboard API.
 *  GET /dashboard
 *  GET /dashboard/sessions
 */

export const dashboardApi = {
  getSummary: () =>
    apiClient.get<DashboardSummary>("/api/dashboard").then((r) => r.data),

  getRecentSessions: (limit = 10) =>
    apiClient
      .get<PracticeSession[]>(`/api/dashboard/sessions${limit ? `?limit=${limit}` : ""}`)
      .then((r) => r.data),
};
