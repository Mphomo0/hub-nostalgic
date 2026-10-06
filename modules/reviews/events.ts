/** Inngest event names used by the Reviews module. Prefix with the module key. */
export const REVIEW_EVENTS = {
  send: "reviews/request.send",
  waFailed: "reviews/whatsapp.failed",
} as const;
