import { describe, expect, it } from "vitest";
import {
  emailSchema,
  monitorInputSchema,
  passwordSchema,
  projectInputSchema,
  signUpSchema,
  slugify,
} from "./schemas";

describe("input validation (security)", () => {
  it("rejects names containing line breaks (email-header / log injection)", () => {
    const result = monitorInputSchema.safeParse({
      name: "Site\r\nBcc: victim@example.com",
      url: "https://example.com",
    });
    expect(result.success).toBe(false);
  });

  it("rejects slugs that try SQL or path tricks", () => {
    for (const slug of ["' OR 1=1--", "../admin", "a b", "<script>", "UPPER"]) {
      const result = projectInputSchema.safeParse({ name: "x", slug });
      if (slug === "UPPER") expect(result.success && result.data.slug).toBe("upper");
      else expect(result.success).toBe(false);
    }
  });

  it("only accepts http(s) URLs for monitors", () => {
    for (const url of ["javascript:alert(1)", "file:///etc/passwd", "ftp://x.com", "data:text/html,hi"]) {
      expect(monitorInputSchema.safeParse({ name: "x", url }).success).toBe(false);
    }
  });

  it("normalises emails and rejects look-alike Unicode addresses", () => {
    expect(emailSchema.parse("  Tausif@Example.COM ")).toBe("tausif@example.com");
    // Fullwidth characters are folded by NFKC before validation.
    expect(emailSchema.parse("ｔｅｓｔ@example.com")).toBe("test@example.com");
    // Cyrillic "а" survives NFKC — refuse it rather than create a look-alike account.
    expect(emailSchema.safeParse("аdmin@example.com").success).toBe(false);
  });

  it("enforces a sensible password policy", () => {
    expect(passwordSchema.safeParse("short1").success).toBe(false);
    expect(passwordSchema.safeParse("onlyletters").success).toBe(false);
    expect(passwordSchema.safeParse("12345678").success).toBe(false);
    expect(passwordSchema.safeParse("a".repeat(80) + "1").success).toBe(false);
    expect(passwordSchema.safeParse("correct-horse-42").success).toBe(true);
  });

  it("refuses passwords that contain the email name", () => {
    const result = signUpSchema.safeParse({
      name: "Tausif",
      email: "tausif@example.com",
      password: "tausif2024",
    });
    expect(result.success).toBe(false);
  });

  it("slugify strips accents and symbols", () => {
    expect(slugify("Café Déjà Vu!!")).toBe("cafe-deja-vu");
  });
});
