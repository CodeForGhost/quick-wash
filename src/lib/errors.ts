/** Errors that carry an HTTP status, so route handlers can map them uniformly. */
export class AppError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "AppError";
    this.status = status;
  }
}

// SRS section 18 - user-facing error messages.
export const ERRORS = {
  invalidAddress: "Please provide a valid pickup address.",
  invalidPickupDate: "Please select a valid pickup date.",
  agentUnavailable: "No pickup agent is currently available.",
  unauthorized: "You do not have permission to perform this action.",
  invalidTransition: "This order cannot be moved to the selected status.",
  priceRequired: "Set the final price before marking this order ready.",
  notFound: "The requested record could not be found.",
  notAuthenticated: "Please sign in to continue.",
} as const;

export const badRequest = (m: string) => new AppError(m, 400);
export const unauthorized = (m: string = ERRORS.notAuthenticated) => new AppError(m, 401);
export const forbidden = (m: string = ERRORS.unauthorized) => new AppError(m, 403);
export const notFound = (m: string = ERRORS.notFound) => new AppError(m, 404);
export const conflict = (m: string) => new AppError(m, 409);
