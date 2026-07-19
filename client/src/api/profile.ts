import { apiClient } from "@/lib/axios";
import type { User, Certificate, ProfileStats } from "@/lib/types";

/**
 * Profile API.
 *  GET  /profile
 *  PUT  /profile
 *  GET  /profile/certificates
 *  GET  /profile/stats
 */

export interface UpdateProfilePayload {
  name?: string;
  email?: string;
  avatarUrl?: string;
  bio?: string;
  location?: string;
}

export const profileApi = {
  get: () => apiClient.get<User>("/api/profile").then((r) => r.data),

  update: (payload: UpdateProfilePayload) =>
    apiClient.put<User>("/api/profile", payload).then((r) => r.data),

  certificates: () =>
    apiClient.get<Certificate[]>("/api/profile/certificates").then((r) => r.data),

  stats: () => apiClient.get<ProfileStats>("/api/profile/stats").then((r) => r.data),
};

export type { User, Certificate, ProfileStats };
