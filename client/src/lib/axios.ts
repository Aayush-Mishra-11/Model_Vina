import axios, { type AxiosInstance, type InternalAxiosRequestConfig, type AxiosResponse, type AxiosAdapter } from "axios";
import { env } from "./env";
import { mockResponder } from "./mock";

/**
 * Centralized Axios client for all REST API calls.
 *
 * The base URL and auth token are pulled from the environment / auth store.
 * Replace `NEXT_PUBLIC_API_BASE_URL` in `.env.local` with your backend URL.
 *
 * This client is purposely backend-agnostic: it just forwards requests to the
 * configured base URL and attaches the bearer token when available.
 *
 * DEMO MODE: if NEXT_PUBLIC_DEMO_MODE=true, a custom axios adapter resolves every
 * call with mock data from `./mock` — NO network request is ever made. Set the
 * flag to "false" (or remove it) once your real backend is live.
 */

const TOKEN_STORAGE_KEY = "conviai.token";

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  else window.localStorage.removeItem(TOKEN_STORAGE_KEY);
}

const demoAdapter: AxiosAdapter = async (config) => {
  // config.url is the relative API path (e.g. "/dashboard"); match on that.
  const url = (config.url ?? "").split("?")[0];
  const method = (config.method ?? "get").toLowerCase();
  let data: unknown;
  if (config.data) {
    data = typeof config.data === "string" ? safeParse(config.data) : config.data;
  }
  const payload = await mockResponder(url, method, data);
  return {
    data: payload,
    status: 200,
    statusText: "OK",
    headers: {},
    config,
    request: {},
  } as AxiosResponse;
};

const apiClient: AxiosInstance = axios.create({
  baseURL: env.apiBaseUrl,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 60_000,
  adapter: env.demoMode ? demoAdapter : undefined,
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (env.demoMode) return config; // adapter handles the rest
  const token = getStoredToken();
  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }
  return config;
});

apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error) => {
    const message =
      error?.response?.data?.message ??
      error?.message ??
      "Something went wrong. Please try again.";
    return Promise.reject(new Error(message));
  },
);

function safeParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export { apiClient };
export default apiClient;
