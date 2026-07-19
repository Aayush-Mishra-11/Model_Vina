import { apiClient } from "@/lib/axios";
import type { ReportItem } from "@/lib/types";

/**
 * Reports API.
 *  GET  /reports
 *  GET  /reports/export?format=csv
 *  GET  /reports/export?format=pdf
 */

export type ReportRange = "week" | "month" | "year" | "all";

export const reportsApi = {
  list: (range: ReportRange = "month") =>
    apiClient.get<ReportItem[]>(`/api/reports?range=${range}`).then((r) => r.data),

  exportCsv: (range: ReportRange = "month") =>
    apiClient
      .get<Blob>(`/api/reports/export?format=csv&range=${range}`, { responseType: "blob" })
      .then((r) => r.data),

  exportPdf: (range: ReportRange = "month") =>
    apiClient
      .get<Blob>(`/api/reports/export?format=pdf&range=${range}`, { responseType: "blob" })
      .then((r) => r.data),
};

export type { ReportItem };
