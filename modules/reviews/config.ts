// Reviews module settings (build plan section 14). Change them in one place.

/** No repeat contact to the same customer within this many days. */
export const REPEAT_CONTACT_DAYS = 30;
/** Ratings at or below this get the private feedback form (Google link is still shown). */
export const LOW_RATING_MAX = 3;
/** One reminder this many days after the request, if the customer has not rated. */
export const REMINDER_DELAY_DAYS = 3;
/** Max rows per CSV upload. */
export const CSV_MAX_ROWS = 500;
