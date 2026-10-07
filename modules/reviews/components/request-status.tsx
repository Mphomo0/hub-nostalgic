import { Badge } from "@/components/ui";
import type { RequestStatus } from "@/lib/generated/prisma/enums";

const LABELS: Record<RequestStatus, { label: string; tone: "neutral" | "good" | "warn" | "bad" }> = {
  QUEUED: { label: "Queued", tone: "neutral" },
  SENT: { label: "Sent", tone: "neutral" },
  FAILED: { label: "Failed", tone: "bad" },
  OPENED: { label: "Opened", tone: "warn" },
  RATED: { label: "Rated", tone: "good" },
  CLICKED_GOOGLE: { label: "Went to Google", tone: "good" },
};

export const STATUS_OPTIONS = Object.entries(LABELS).map(([value, v]) => ({ value: value as RequestStatus, label: v.label }));

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  const s = LABELS[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function Stars({ rating }: { rating: number | null }) {
  if (!rating) return <span className="text-muted">—</span>;
  return (
    <span role="img" aria-label={`${rating} out of 5 stars`} className="whitespace-nowrap">
      <span className="text-star">{"★".repeat(rating)}</span>
      <span className="text-line">{"★".repeat(5 - rating)}</span>
    </span>
  );
}
