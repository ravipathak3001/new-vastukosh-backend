import { GraphQLError } from "graphql";

export const ERROR_CODES = [
  "BAD_INPUT",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "RATE_LIMITED",
  "INTERNAL",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

const HTTP_STATUS: Record<ErrorCode, number> = {
  BAD_INPUT: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL: 500,
};

/**
 * Domain error. Extends `GraphQLError` so the `code` lands in `extensions` at
 * throw time and survives GraphQL execution + Yoga's error normalisation — the
 * client always sees a stable `extensions.code`.
 */
export class AppError extends GraphQLError {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message, {
      extensions: {
        code,
        http: { status: HTTP_STATUS[code] },
        ...(details ? { details } : {}),
      },
    });
    this.name = "AppError";
    this.code = code;
  }
}

export function isDomainCode(code: unknown): code is ErrorCode {
  return typeof code === "string" && (ERROR_CODES as readonly string[]).includes(code);
}

export const badInput = (msg: string, details?: unknown) =>
  new AppError("BAD_INPUT", msg, details);
export const unauthenticated = (msg = "Authentication required") =>
  new AppError("UNAUTHENTICATED", msg);
export const forbidden = (msg = "Not allowed") => new AppError("FORBIDDEN", msg);
export const notFound = (what: string) =>
  new AppError("NOT_FOUND", `${what} not found`);
export const conflict = (msg: string) => new AppError("CONFLICT", msg);
