import type { ReactNode } from "react";
import { buttonClass, type buttonStyles } from "@/components/ui";

type Variant = keyof typeof buttonStyles;

/**
 * Two-step confirmation for destructive actions. Built on <details>, so it
 * works before JavaScript loads: the real submit button (children) only
 * exists once the person has opened the panel and read the warning.
 * Put it inside the <form> that performs the action.
 */
export function ConfirmAction({
  trigger,
  triggerLabel,
  triggerVariant = "secondary",
  triggerClassName,
  message,
  className,
  children,
}: {
  trigger: ReactNode;
  /** Accessible name when several triggers share the same visible text, e.g. "Remove Thandi". */
  triggerLabel?: string;
  triggerVariant?: Variant;
  triggerClassName?: string;
  message: ReactNode;
  className?: string;
  /** The confirming submit button. */
  children: ReactNode;
}) {
  return (
    <details className={className ? `relative ${className}` : "relative inline-block"}>
      <summary
        aria-label={triggerLabel}
        className={buttonClass(triggerVariant, `cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden ${triggerClassName ?? ""}`)}
      >
        {trigger}
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-72 max-w-[calc(100vw-2rem)] space-y-3 rounded-xl border border-line bg-card p-4 text-left text-sm font-normal shadow-lg">
        <p>{message}</p>
        {children}
      </div>
    </details>
  );
}
