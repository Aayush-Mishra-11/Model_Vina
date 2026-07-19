import { type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function SectionHeader({
  title,
  subtitle,
  action,
  actionHref,
}: {
  title: string;
  subtitle?: string;
  action?: string;
  actionHref?: string;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h2 className="font-display text-xl font-semibold tracking-tight">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action && actionHref && (
        <Link
          href={actionHref}
          className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          {action} <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}
