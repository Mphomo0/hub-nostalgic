import { Star } from "lucide-react";
import type { ModuleDefinition } from "@/modules/types";

/** The Reviews module: send review requests, collect ratings, guide customers to Google. */
export const reviewsModule = {
  key: "reviews",
  name: "Reviews",
  tagline: "Get more Google reviews from happy customers, automatically.",
  icon: Star,
  marketing: { href: "/reviews" },
  nav: [
    { href: "/dashboard/reviews", label: "Overview" },
    { href: "/dashboard/reviews/send", label: "Send requests" },
    { href: "/dashboard/reviews/requests", label: "Requests" },
    { href: "/dashboard/reviews/customers", label: "Customers" },
    { href: "/dashboard/reviews/feedback", label: "Feedback" },
    { href: "/dashboard/reviews/settings", label: "Settings" },
  ],
  status: "available",
} satisfies ModuleDefinition;
