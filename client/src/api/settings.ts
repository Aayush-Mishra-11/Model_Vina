import { apiClient } from "@/lib/axios";
import type { NotificationSettings } from "@/lib/types";

/**
 * Settings API.
 *  GET /settings
 *  PUT /settings
 */

export interface UpdateSettingsPayload {
  language?: string;
  notifications?: NotificationSettings;
  englishOnlyMode?: boolean;
  selectedVoice?: string;
}

export const settingsApi = {
  get: () =>
    apiClient
      .get<{ language: string; notifications: NotificationSettings; englishOnlyMode: boolean; selectedVoice: string }>(
        "/api/settings",
      )
      .then((r) => r.data),

  update: (payload: UpdateSettingsPayload) =>
    apiClient.put<{ message: string }>("/api/settings", payload).then((r) => r.data),
};

export type { NotificationSettings };
