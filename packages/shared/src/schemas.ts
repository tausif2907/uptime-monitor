import { z } from "zod";
import { DEFAULT_TIMEOUT_MS, INTERVAL_OPTIONS, MAX_TIMEOUT_MS } from "./constants";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// Control characters (incl. CR/LF) would end up in email subjects, logs and webhook payloads.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS_RE = /[\u0000-\u001f\u007f-\u009f]/;

/** A trimmed, single-line, human-readable label. */
const label = (max: number, requiredMessage = "Name is required") =>
  z
    .string()
    .trim()
    .min(1, requiredMessage)
    .max(max, `Keep it under ${max} characters`)
    .refine((v) => !CONTROL_CHARS_RE.test(v), "Remove line breaks and special control characters");

export const projectInputSchema = z.object({
  name: label(80),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "Slug must be at least 3 characters")
    .max(48)
    .regex(SLUG_RE, "Use lowercase letters, numbers and dashes"),
});
export type ProjectInput = z.infer<typeof projectInputSchema>;

export const httpUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .url("Enter a valid URL, e.g. https://example.com")
  .refine((value) => /^https?:\/\//i.test(value), "URL must start with http:// or https://");

export const monitorInputSchema = z.object({
  name: label(100),
  url: httpUrlSchema,
  method: z.enum(["GET", "HEAD", "POST"]).default("GET"),
  intervalSec: z.coerce
    .number()
    .int()
    .refine(
      (v) => (INTERVAL_OPTIONS as readonly number[]).includes(v),
      "Interval must be 1, 2, 3 or 5 minutes",
    )
    .default(60),
  timeoutMs: z.coerce.number().int().min(1000).max(MAX_TIMEOUT_MS).default(DEFAULT_TIMEOUT_MS),
  expectedStatus: z.coerce.number().int().min(100).max(599).default(200),
});
export type MonitorInput = z.infer<typeof monitorInputSchema>;

/**
 * Emails are normalised (Unicode NFKC, lower-case) BEFORE validation and restricted to ASCII,
 * so look-alike characters can't create a second account that renders like someone else's.
 */
export const emailSchema = z
  .string()
  .transform((v) => v.normalize("NFKC").trim().toLowerCase())
  .pipe(
    z
      .string()
      .max(254)
      .email("Enter a valid email address")
      .regex(/^[\x21-\x7e]+$/, "Use a plain ASCII email address"),
  );

export const PASSWORD_MIN = 8;
// bcrypt only uses the first 72 bytes; refuse longer input instead of silently truncating it.
export const PASSWORD_MAX = 72;

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters`)
  .max(PASSWORD_MAX, `Use at most ${PASSWORD_MAX} characters`)
  .refine((v) => /[a-zA-Z]/.test(v) && /[0-9]/.test(v), "Include at least one letter and one number");

export const signUpSchema = z
  .object({
    name: label(80, "Tell us your name"),
    email: emailSchema,
    password: passwordSchema,
  })
  .refine((v) => !v.password.toLowerCase().includes(v.email.split("@")[0] ?? "\u0000"), {
    message: "Your password shouldn't contain your email address",
    path: ["password"],
  });
export type SignUpInput = z.infer<typeof signUpSchema>;

export const signInSchema = z.object({
  email: emailSchema,
  // Never validate password strength on sign-in (it would leak the policy per account).
  password: z.string().min(1, "Enter your password").max(PASSWORD_MAX),
  // Authenticator or backup code, only sent when the account has 2FA enabled.
  code: z.string().trim().max(20).optional(),
});

export const resetPasswordSchema = z.object({
  email: emailSchema,
  token: z.string().min(20).max(200),
  password: passwordSchema,
});

export const alertChannelInputSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("EMAIL"), target: emailSchema }),
  z.object({ type: z.literal("WEBHOOK"), target: httpUrlSchema }),
]);
export type AlertChannelInput = z.infer<typeof alertChannelInputSchema>;

/** Turn a project name into a URL-safe slug candidate. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}
