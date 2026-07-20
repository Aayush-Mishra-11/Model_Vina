/**
 * Centralized environment configuration.
 * All values are read from NEXT_PUBLIC_* environment variables so they are
 * safe to expose to the browser. Replace the values in `.env.local`.
 */

export const env = {
  apiBaseUrl:
    process.env.NEXT_PUBLIC_API_URL ?? "https://model-vani-p22q.onrender.com",
  socketUrl:
    process.env.NEXT_PUBLIC_SOCKET_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "https://model-vani-p22q.onrender.com",
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "Vani AI",
  // When "true", the axios client returns mock data and makes ZERO network calls.
  // Perfect for clicking through the UI with no backend. Set to "false" (or remove)
  // once your real backend is live.
  demoMode: process.env.NEXT_PUBLIC_DEMO_MODE === "true",
} as const;
