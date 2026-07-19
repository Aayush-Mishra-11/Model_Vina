"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode } from "react";
import { Toaster } from "react-hot-toast";
import { queryClient } from "@/lib/query-client";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>

      {children}
      <Toaster
        position="top-right"
        toastOptions={{
          className: "glass-strong",
          style: {
            borderRadius: "0.9rem",
            fontSize: "0.875rem",
          },
        }}
      />
    </QueryClientProvider>
  );
}
