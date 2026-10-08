// One error type for every failed request, so screens branch on `kind` instead
// of parsing status codes and fetch exceptions themselves.

export type ApiErrorKind =
  | "network" // no connection / DNS / TLS
  | "timeout"
  | "unauthorized" // 401: missing or expired session
  | "forbidden" // 403
  | "not_found"
  | "validation" // 400 / 422
  | "conflict" // 409
  | "rate_limited" // 429
  | "payment_required" // 402 (plan quota)
  | "server"; // 5xx or unreadable response

export class ApiError extends Error {
  constructor(
    public kind: ApiErrorKind,
    message: string,
    public status?: number,
    /** The server's JSON body, e.g. `{ error, issues, reason, locked }`. */
    public body?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function kindForStatus(status: number): ApiErrorKind {
  if (status === 401) return "unauthorized";
  if (status === 402) return "payment_required";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 409) return "conflict";
  if (status === 429) return "rate_limited";
  if (status === 400 || status === 422) return "validation";
  return "server";
}

const FRIENDLY: Record<ApiErrorKind, string> = {
  network: "You're offline or the server can't be reached. Check your connection and try again.",
  timeout: "The server is taking too long to respond. Please try again.",
  unauthorized: "Your session has expired. Please log in again.",
  forbidden: "You don't have access to this.",
  not_found: "We couldn't find that.",
  validation: "Please check the details and try again.",
  conflict: "That conflicts with something that already exists.",
  rate_limited: "Too many requests. Wait a moment and try again.",
  payment_required: "You've reached your plan's limit. Upgrade to continue.",
  server: "Something went wrong on our side. Please try again.",
};

/** A message safe to show a user: the server's own text when it sent one. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.kind === "network" || err.kind === "timeout" || err.kind === "server") return FRIENDLY[err.kind];
    return err.message || FRIENDLY[err.kind];
  }
  return FRIENDLY.server;
}

export function isOfflineError(err: unknown) {
  return err instanceof ApiError && (err.kind === "network" || err.kind === "timeout");
}
