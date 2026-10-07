"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { startTransition, useActionState, useState, type FormEvent } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { FieldError } from "@/components/form-state";
import { Button, cx, Textarea } from "@/components/ui";
import { feedbackSchema, ratingSchema } from "@/modules/reviews/schemas";
import { feedbackAction, rateAction, type RateState } from "./actions";

type Props = { token: string; firstName: string; businessName: string; initial: RateState };

/**
 * Returns a callback that submits this form to a server action (including the
 * clicked button's value). The form and button are read now, because
 * react-hook-form calls the callback later, after the event has finished.
 */
function submitTo(event: FormEvent<HTMLFormElement>, action: (fd: FormData) => void) {
  const form = event.currentTarget;
  const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
  return () => {
    const fd = new FormData(form, submitter);
    startTransition(() => action(fd));
  };
}

/** Own component so hovering a star re-renders only the stars, not both forms. */
function StarPicker({ onPick }: { onPick: (n: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex justify-center gap-1 sm:gap-2" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="submit"
          name="rating"
          value={n}
          onClick={() => onPick(n)}
          onMouseEnter={() => setHover(n)}
          onFocus={() => setHover(n)}
          onBlur={() => setHover(0)}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          className={cx("text-5xl leading-none transition-transform hover:scale-110 sm:text-6xl", n <= hover ? "text-star" : "text-line")}
        >
          ★
        </button>
      ))}
    </div>
  );
}

/**
 * Step 1: everyone picks 1–5 stars.
 * Step 2: everyone sees the Google button. 1–3 star raters also get a private
 * feedback form. The Google link is never hidden (Google prohibits review gating).
 * Forms also have a plain `action`, so they work before JavaScript loads.
 */
export function RatingFlow(props: Props) {
  // The live region stays mounted while the steps swap, so screen readers announce the change.
  return (
    <div aria-live="polite">
      <RatingSteps {...props} />
    </div>
  );
}

function RatingSteps({ token, firstName, businessName, initial }: Props) {
  const [state, rate, ratePending] = useActionState(rateAction, initial);
  const [fbState, sendFeedback, fbPending] = useActionState(feedbackAction, initial);

  const rating = useForm<z.input<typeof ratingSchema>>({ resolver: zodResolver(ratingSchema), defaultValues: { token, rating: 0 } });
  const feedback = useForm<z.input<typeof feedbackSchema>>({ resolver: zodResolver(feedbackSchema), mode: "onTouched", defaultValues: { token, message: "" } });

  if (!state?.rating) {
    return (
      <form
        action={rate}
        noValidate
        onSubmit={(e) => rating.handleSubmit(submitTo(e, rate))(e)}
        className="text-center"
      >
        <input type="hidden" {...rating.register("token")} />
        <h1 className="text-xl font-semibold">Hi {firstName}, how was your experience with {businessName}?</h1>
        <p className="mt-2 text-sm text-muted">Tap a star to rate.</p>
        <fieldset className="mt-6" disabled={ratePending}>
          <legend className="sr-only">Rating from 1 to 5 stars</legend>
          <StarPicker onPick={(n) => rating.setValue("rating", n)} />
        </fieldset>
        <FieldError error={rating.formState.errors.rating} />
        {state?.error && <p role="alert" className="mt-4 text-sm text-danger">{state.error}</p>}
      </form>
    );
  }

  const feedbackSent = fbState?.feedbackSent || state.feedbackSent;
  return (
    <div className="text-center">
      <div role="img" aria-label={`You rated ${state.rating} out of 5`} className="text-3xl">
        <span className="text-star">{"★".repeat(state.rating)}</span>
        <span className="text-line">{"★".repeat(5 - state.rating)}</span>
      </div>
      <h1 className="mt-3 text-xl font-semibold">Thank you, {firstName}!</h1>
      <p className="mt-2 text-sm text-muted">
        {state.low ? `We’re sorry it wasn’t perfect. You’re welcome to share your review on Google.` : `Would you share your experience on Google? It really helps ${businessName}.`}
      </p>
      <a
        href={`/r/${token}/go`}
        rel="noopener noreferrer"
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-5 py-4 text-base font-semibold text-brand-ink shadow-sm hover:brightness-110"
      >
        Leave a Google review
      </a>

      {state.low && (
        <div className="mt-8 border-t border-line pt-6 text-left">
          {feedbackSent ? (
            <p className="rounded-lg bg-brand-soft px-4 py-3 text-sm text-brand-strong">Thanks for telling us. {businessName} will read your message.</p>
          ) : (
            <form
              action={sendFeedback}
              noValidate
              onSubmit={(e) => feedback.handleSubmit(submitTo(e, sendFeedback))(e)}
            >
              <input type="hidden" {...feedback.register("token")} />
              <label htmlFor="message" className="block font-medium">Want to tell us directly so we can put it right?</label>
              <p className="mt-1 text-xs text-muted">This goes privately to {businessName}.</p>
              <Textarea id="message" rows={4} aria-invalid={!!feedback.formState.errors.message} className="mt-3" {...feedback.register("message")} />
              <FieldError error={feedback.formState.errors.message} />
              {fbState?.error && <p role="alert" className="mt-1 text-sm text-danger">{fbState.error}</p>}
              <Button type="submit" variant="secondary" disabled={fbPending} className="mt-3 w-full">
                {fbPending ? "Sending…" : "Send privately"}
              </Button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
