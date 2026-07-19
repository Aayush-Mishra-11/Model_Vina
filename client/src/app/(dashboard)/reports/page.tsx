"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Download, FileSpreadsheet, Share2, Calendar, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SectionHeader } from "@/components/dashboard/section-header";
import { useApi } from "@/hooks/use-api";
import { reportsApi, type ReportRange } from "@/api/reports";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

const ranges: ReportRange[] = ["week", "month", "year", "all"];

const typeLabels: Record<string, string> = {
  free_practice: "Practice",
  speaking_partner: "Partner",
  mock_interview: "Interview",
  daily_challenge: "Challenge",
};

function fmtDuration(seconds: number) {
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export default function ReportsPage() {
  const [range, setRange] = useState<ReportRange>("month");
  const { data, isLoading } = useApi(["reports", range], () => reportsApi.list(range));
  const [exporting, setExporting] = useState<null | "csv" | "pdf">(null);

  const handleExport = (format: "csv" | "pdf") => {
    setExporting(format);
    const fn = format === "csv" ? reportsApi.exportCsv : reportsApi.exportPdf;
    fn(range)
      .then(() => toast.success(`${format.toUpperCase()} report downloaded`))
      .catch(() => toast.error("Export failed"))
      .finally(() => setExporting(null));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <SectionHeader title="Reports" subtitle="Review your sessions history and progress." />
        <div className="flex items-center gap-2">
          <div className="flex gap-1 rounded-xl bg-secondary p-1">
            {ranges.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition-colors",
                  range === r ? "bg-background shadow-soft" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button variant="gradient" onClick={() => toast.success("Share link copied")}>
          <Share2 className="h-4 w-4" /> Share report
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded-lg bg-secondary/50" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Grammar</TableHead>
                  <TableHead>Pronunciation</TableHead>
                  <TableHead>Fluency</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data ?? []).map((r, i) => (
                  <motion.tr
                    key={r.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="border-b transition-colors hover:bg-secondary/50"
                  >
                    <TableCell className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {formatDate(r.date)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{typeLabels[r.type] ?? r.type}</Badge>
                    </TableCell>
                    <TableCell>{fmtDuration(r.durationSeconds)}</TableCell>
                    <TableCell>{r.grammar}%</TableCell>
                    <TableCell>{r.pronunciation}%</TableCell>
                    <TableCell>{r.fluency}%</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="success">{r.score}%</Badge>
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          )}
          {data && data.length === 0 && (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No sessions in this range yet.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
