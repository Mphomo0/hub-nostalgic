/**
 * Thrown by message providers (email / WhatsApp).
 * permanent = retrying will not help (bad address, rejected template, etc.)
 * transient = worth retrying (rate limit, provider outage, network error).
 */
export class DeliveryError extends Error {
  constructor(message: string, public permanent: boolean, public details?: unknown) {
    super(message);
    this.name = "DeliveryError";
  }
}
