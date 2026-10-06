import { requireModule } from "@/lib/session";

/** Every /dashboard/reviews page requires the Reviews module (actions check again themselves). */
export default async function ReviewsLayout({ children }: LayoutProps<"/dashboard/reviews">) {
  await requireModule("reviews");
  return children;
}
