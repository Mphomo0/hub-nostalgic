import Image from "next/image";
import { PLATFORM_NAME } from "@/lib/config";

/** The Nostalgic Hub wordmark (public/logo.png, 1410×220). Size it with a height class, e.g. "h-7". */
export function Logo({ className = "h-7", priority }: { className?: string; priority?: boolean }) {
  return <Image src="/logo.png" alt={PLATFORM_NAME} width={1410} height={220} priority={priority} className={`w-auto ${className}`} />;
}
