import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "./errors";
import { firstIssue } from "./validation";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

/**
 * Wraps a route handler so domain errors and validation errors are reported
 * with the right status instead of surfacing as a 500.
 */
export function handle<T extends unknown[]>(fn: (...args: T) => Promise<Response>) {
  return async (...args: T): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof ZodError) return fail(firstIssue(error), 422);
      if (error instanceof AppError) return fail(error.message, error.status);
      console.error("[api]", error);
      return fail("Something went wrong. Please try again.", 500);
    }
  };
}

/** Reads a JSON body, tolerating an empty one. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
