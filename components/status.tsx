import { Badge } from "@/components/ui";

export function ClientStatusBadge({ status }: { status: "ACTIVE" | "PAUSED" }) {
  return status === "ACTIVE" ? <Badge tone="good">Active</Badge> : <Badge tone="warn">Paused</Badge>;
}
