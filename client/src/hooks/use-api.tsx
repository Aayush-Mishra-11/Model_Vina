"use client";

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { type ReactNode } from "react";
import { LoadingSpinner, ErrorState } from "@/components/state-views";

/**
 * Shared data-fetching hook built on TanStack Query + the axios API layer.
 * Handles loading / error / success states consistently across pages.
 */
export function useApi<T>(
  key: unknown[],
  fetcher: () => Promise<T>,
  options?: Omit<UseQueryOptions<T, Error>, "queryKey" | "queryFn">,
) {
  return useQuery<T, Error>({
    queryKey: key,
    queryFn: fetcher,
    ...options,
  });
}

export function QueryState({
  isLoading,
  isError,
  onRetry,
  children,
  loading = <LoadingSpinner />,
}: {
  isLoading: boolean;
  isError: boolean;
  onRetry?: () => void;
  children: ReactNode;
  loading?: ReactNode;
}) {
  if (isLoading) return <>{loading}</>;
  if (isError) return <ErrorState onRetry={onRetry} />;
  return <>{children}</>;
}
