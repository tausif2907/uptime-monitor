import { z } from "zod";
import { DEFAULT_TIMEOUT_MS, INTERVAL_OPTIONS, MAX_TIMEOUT_MS } from "./constants";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const projectInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
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
  .url("Enter a valid URL")
  .refine((value) => /^https?:\/\//i.test(value), "URL must start with http:// or https://");

export const monitorInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
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

export const alertChannelInputSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("EMAIL"), target: z.string().trim().email("Enter a valid email") }),
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
