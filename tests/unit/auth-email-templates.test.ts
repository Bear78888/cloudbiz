import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Supabase's own auth emails (confirmation, magic link) — §10.1.
 *
 * These are Go templates rendered by GoTrue, not by our code, so there is no
 * engine here to actually render them: Node cannot execute Go's `text/template`
 * syntax, and this sandbox has no Docker to run the real local stack against.
 * What is checked instead is the class of mistake that is both easy to make by
 * hand and would otherwise only surface as a broken email in someone's inbox —
 * an unbalanced `{{ if }}`, a `content_path` that points at a file which does
 * not exist, a button color that quietly drifts from the rest of HandyAlliance
 * mail. Whether `.Data.preferred_locale` actually selects the branch it should
 * is documented behaviour (Supabase's own docs show the identical
 * `{{ if eq .Data.Domain ... }}` pattern for exactly this purpose) rather than
 * something proven by a test in this repository.
 */

const ROOT = join(__dirname, "..", "..");
const CONFIG = readFileSync(join(ROOT, "supabase", "config.toml"), "utf8");

const TEMPLATES = [
  { name: "confirmation", spanishTell: "Confirma tu cuenta", englishTell: "Confirm your account" },
  { name: "magic_link", spanishTell: "Tu enlace de acceso", englishTell: "Your sign-in link" },
] as const;

describe.each(TEMPLATES)("$name.html", ({ name, spanishTell, englishTell }) => {
  const path = join(ROOT, "supabase", "templates", `${name}.html`);
  const html = existsSync(path) ? readFileSync(path, "utf8") : null;

  it("exists where config.toml says it does", () => {
    expect(html, `supabase/templates/${name}.html is missing`).not.toBeNull();
  });

  it("branches on preferred_locale exactly once, fully closed", () => {
    expect(html).toBeTruthy();
    const opens = html!.match(/\{\{\s*if eq \.Data\.preferred_locale "es"\s*\}\}/g) ?? [];
    const elses = html!.match(/\{\{\s*else\s*\}\}/g) ?? [];
    const ends = html!.match(/\{\{\s*end\s*\}\}/g) ?? [];
    expect(opens).toHaveLength(1);
    expect(elses).toHaveLength(1);
    expect(ends).toHaveLength(1);
  });

  it("has both languages, in the right order (Spanish branch first)", () => {
    const ifIndex = html!.indexOf('if eq .Data.preferred_locale "es"');
    const elseIndex = html!.indexOf("{{ else }}");
    const spanishIndex = html!.indexOf(spanishTell);
    const englishIndex = html!.indexOf(englishTell);

    expect(spanishIndex).toBeGreaterThan(ifIndex);
    expect(spanishIndex).toBeLessThan(elseIndex);
    expect(englishIndex).toBeGreaterThan(elseIndex);
  });

  // One as the button's href, one as the copy-paste fallback — in both
  // languages. Four in the document, plus one more in the explanatory
  // comment at the top of the file.
  it("gives the customer the confirmation link twice per language", () => {
    const total = (html!.match(/\.ConfirmationURL/g) ?? []).length;
    expect(total).toBe(5);
  });

  it("uses the platform's actual brand color, not a placeholder", () => {
    expect(html).toContain("#2554eb");
    expect(html).not.toContain("#0d9488");
  });

  it("has no script content", () => {
    expect(html!.toLowerCase()).not.toContain("<script");
  });

  it("declares the right lang attribute in each branch", () => {
    expect(html).toContain('<html lang="es">');
    expect(html).toContain('<html lang="en">');
  });
});

describe("config.toml wiring", () => {
  it("points at files that exist, for both templates", () => {
    for (const { name } of TEMPLATES) {
      expect(CONFIG).toContain(`content_path = "./supabase/templates/${name}.html"`);
    }
  });

  it("subjects are bilingual too, not just the body", () => {
    expect(CONFIG).toContain("Confirma tu cuenta de HandyAlliance");
    expect(CONFIG).toContain("Confirm your HandyAlliance account");
    expect(CONFIG).toContain("Tu enlace de acceso a HandyAlliance");
    expect(CONFIG).toContain("Your HandyAlliance sign-in link");
  });
});
