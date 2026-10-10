import { GraphQLError } from "graphql";
import type { ZodError, ZodIssue } from "zod";

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

/** One invalid field, as sent in `extensions.details.fields` of a BAD_INPUT error. */
export type FieldIssue = {
  field: string;
  code: string;
  message: string;
  minimum?: number;
  maximum?: number;
};

const humanize = (field: string) => {
  const words = field.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

function issueMessage(issue: ZodIssue, label: string): string {
  switch (issue.code) {
    case "too_small":
      if (issue.type === "string") {
        return Number(issue.minimum) <= 1
          ? `${label} is required`
          : `${label} must be at least ${issue.minimum} characters`;
      }
      if (issue.type === "array") return `Add at least ${issue.minimum} ${label.toLowerCase()}`;
      return `${label} must be at least ${issue.minimum}`;
    case "too_big":
      if (issue.type === "string") return `${label} must be at most ${issue.maximum} characters`;
      if (issue.type === "array") return `${label} can have at most ${issue.maximum} items`;
      return `${label} must be at most ${issue.maximum}`;
    case "invalid_string":
      if (issue.validation === "email") return "Enter a valid email address";
      if (issue.validation === "url") return `${label} must be a valid link (starting with https://)`;
      return `${label} is not in the right format`;
    case "invalid_type":
      return issue.received === "undefined" || issue.received === "null"
        ? `${label} is required`
        : `${label} is not valid`;
    case "invalid_enum_value":
      return `Choose a valid ${label.toLowerCase()}`;
    default:
      // Custom refinements carry their own human-written message.
      return issue.message && issue.message !== "Invalid input" ? issue.message : `${label} is not valid`;
  }
}

/**
 * Turns a zod failure into a client-safe BAD_INPUT error: a readable message
 * for the first problem, plus every invalid field in `details.fields` so forms
 * can point at the right input.
 */
export function zodToAppError(error: ZodError): AppError {
  const fields: FieldIssue[] = error.issues.map((issue) => {
    const field = String([...issue.path].reverse().find((p) => typeof p === "string") ?? "input");
    return {
      field,
      code: issue.code === "invalid_string" && issue.validation === "email" ? "invalid_email" : issue.code,
      message: issueMessage(issue, humanize(field)),
      ...("minimum" in issue ? { minimum: Number(issue.minimum) } : {}),
      ...("maximum" in issue ? { maximum: Number(issue.maximum) } : {}),
    };
  });
  return badInput(fields[0]?.message ?? "Some details are not valid", { fields });
}
