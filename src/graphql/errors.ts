import type { GraphQLFormattedError } from "graphql";
import { unwrapResolverError } from "@apollo/server/errors";
import { ZodError } from "zod";
import { isDomainCode, zodToAppError } from "../shared/errors.js";
import { isProd } from "../config/env.js";
import { logger } from "../config/logger.js";

/** Validation / client-fault codes that are always safe to show as-is. */
const SAFE_CODES = new Set([
  "BAD_USER_INPUT",
  "BAD_REQUEST",
  "VALIDATION_ERROR",
  "ZOD_ERROR",
  "GRAPHQL_VALIDATION_FAILED",
  "GRAPHQL_PARSE_FAILED",
  "PERSISTED_QUERY_NOT_FOUND",
  "PERSISTED_QUERY_NOT_SUPPORTED",
  "OPERATION_RESOLUTION_FAILURE",
]);

/**
 * Apollo Server `formatError` hook. Domain errors (our `AppError`, recognised by
 * `extensions.code`) and validation errors pass through untouched; anything else
 * is logged and replaced with a generic INTERNAL error so implementation details
 * never leak to clients.
 */
export function formatError(
  formatted: GraphQLFormattedError,
  error: unknown,
): GraphQLFormattedError {
  const code = formatted.extensions?.code;

  if (isDomainCode(code) || (typeof code === "string" && SAFE_CODES.has(code))) {
    return formatted;
  }

  // A schema `.parse()` inside a service is the caller's bad input, not a crash.
  const original = unwrapResolverError(error);
  if (original instanceof ZodError) {
    const appError = zodToAppError(original);
    return { message: appError.message, path: formatted.path, locations: formatted.locations, extensions: appError.extensions };
  }

  logger.error({ err: original }, "Unhandled GraphQL error");

  return {
    message: isProd ? "Internal server error" : formatted.message,
    path: formatted.path,
    locations: formatted.locations,
    extensions: { code: "INTERNAL" },
  };
}
