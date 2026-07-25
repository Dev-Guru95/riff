import { NextResponse } from "next/server";
import { z } from "zod";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function fail(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export function tooMany(retryAfterSec: number) {
  return NextResponse.json(
    { error: "Too many requests — slow down." },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
  );
}

/**
 * Wrap a route handler so any thrown error is caught, logged, and returned as a
 * sanitized 500 (never leaks a stack trace to the client). Audit H10.
 */
export function withRoute<A extends unknown[]>(
  handler: (req: Request, ...args: A) => Promise<Response>,
) {
  return async (req: Request, ...args: A): Promise<Response> => {
    try {
      return await handler(req, ...args);
    } catch (err) {
      console.error(`[route] ${req.method} ${new URL(req.url).pathname} failed:`, err);
      return fail("Something went wrong. Please try again.", 500);
    }
  };
}

/** Parse + validate a request body against a zod schema. */
export async function parseBody<T extends z.ZodTypeAny>(
  req: Request,
  schema: T,
): Promise<{ data: z.infer<T>; error?: never } | { data?: never; error: NextResponse }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { error: fail("Invalid JSON body") };
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    return { error: fail("Validation failed", 422, { issues: result.error.flatten() }) };
  }
  return { data: result.data };
}
