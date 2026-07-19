import { apiClient } from "@/lib/axios";
import type { AuthResponse, User } from "@/lib/types";

/**
 * Authentication API.
 *
 * Endpoints expected on the backend (replace with your actual routes):
 *  POST /auth/login
 *  POST /auth/register
 *  POST /auth/forgot-password
 *  POST /auth/reset-password
 *  POST /auth/verify
 *  GET  /auth/me
 */

export interface LoginPayload {
  email: string;
  password: string;
}

export interface SignupPayload {
  name: string;
  email: string;
  password: string;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface ResetPasswordPayload {
  token: string;
  password: string;
}

export const authApi = {
  login: (payload: LoginPayload) =>
    apiClient.post<AuthResponse>("/api/auth/login", payload).then((r) => r.data),

  signup: (payload: SignupPayload) =>
    apiClient.post<AuthResponse>("/api/auth/register", payload).then((r) => r.data),

  forgotPassword: (payload: ForgotPasswordPayload) =>
    apiClient.post<{ message: string }>("/api/auth/forgot-password", payload).then((r) => r.data),

  resetPassword: (payload: ResetPasswordPayload) =>
    apiClient.post<{ message: string }>("/api/auth/reset-password", payload).then((r) => r.data),

  verify: (token: string) =>
    apiClient.post<AuthResponse>("/api/auth/verify", { token }).then((r) => r.data),

  me: () => apiClient.get<User>("/api/auth/me").then((r) => r.data),
};
