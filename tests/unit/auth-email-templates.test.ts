import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Supabase's own auth emails (confirmation, magic link) — §10.1.
 *
 * These are Go templates rendered by GoTrue, not by our code, so Node has no
 * engine to render them the way GoTrue does — but this repo does have a Go
 * toolchain even without Docker, and that turned out to be enough: the real
 * bug below was found and verified by executing the actual template content
 * through Go's real `html/template` package with the actual data shapes
 * GoTrue's own source produces, not by reasoning about the syntax from
 * outside — that last part mattered enough to cost a whole extra CI
 * round-trip on its own (bug 3 below). What's checked here is structural —
 * an unbalanced `{{ if }}`, a `content_path` that points at a file which
 * does not exist, a button color that quietly drifts from the rest of
 * HandyAlliance mail — plus regression guards against three specific
 * defects a real e2e run against the real local GoTrue stack actually
 * caught, in order:
 *
 * 1. Comparing `.Data.preferred_locale` to "es" directly made signInWithOtp()
 *    fail outright (HTTP 500 "Error sending magic link email", not "wrong
 *    language").
 * 2. Wrapping that comparison in `print(...)` did not fix it — the next e2e
 *    run failed identically. The real cause: for a brand-new user created via
 *    signInWithOtp()'s `create_user: true`, GoTrue hands the template a bare
 *    untyped-nil `.Data`, and `.Data.preferred_locale` panics evaluating the
 *    field itself, before `print`/`eq` ever run. `{{ with .Data }}` is the
 *    guard that's actually null-safe — it skips its block instead of
 *    erroring on nil of any kind — so the locale is read into a plain
 *    variable inside that guard, and every branch reads the variable, never
 *    `.Data` directly.
 * 3. That guard was verified in isolation (a standalone template string) but
 *    not re-verified in place after landing in the real file — and the real
 *    file's own explanatory comment described the guard by spelling it out
 *    in literal `{{ }}` form. Go's template lexer scans the *entire* raw
 *    source for that delimiter; an HTML comment is not a template comment
 *    and gives no protection. The unmatched `with` sitting in prose broke
 *    parsing outright, behind the exact same generic 500 as bugs 1 and 2,
 *    on every render — found only by re-executing the actual file on disk,
 *    not the isolated snippet that had already passed.
 *
 * See supabase/templates/confirmation.html for the full account of all
 * three bugs and docs/HANDYALLIANCE_ARCHITECTURE.md §5i for how each was
 * diagnosed.
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

  it("guards .Data with `with` before ever reading a field off it", () => {
    expect(html).toBeTruthy();
    expect(html).toContain('{{ $locale := "" }}');
    expect(html).toContain("{{ with .Data }}{{ $locale = print .preferred_locale }}{{ end }}");
  });

  it("branches on the guarded $locale variable exactly once, fully closed", () => {
    expect(html).toBeTruthy();
    const withs = html!.match(/\{\{\s*with \.Data\s*\}\}/g) ?? [];
    const ifs = html!.match(/\{\{\s*if eq \$locale "es"\s*\}\}/g) ?? [];
    const elses = html!.match(/\{\{\s*else\s*\}\}/g) ?? [];
    const ends = html!.match(/\{\{\s*end\s*\}\}/g) ?? [];
    expect(withs).toHaveLength(1);
    expect(ifs).toHaveLength(1);
    expect(elses).toHaveLength(1);
    // One `end` closes the `with` guard, the other closes the `if`/`else`.
    expect(ends).toHaveLength(2);
  });

  // A third bug, found after the `with` guard above was already believed
  // correct: the file's own explanatory comment spelled the guard out in
  // literal double-brace form to describe it, and Go's template lexer does
  // not know HTML comments are comments — it scans the entire raw file for
  // that delimiter unconditionally. An unmatched `with` sitting in prose
  // broke parsing outright, behind the exact same generic error as the two
  // runtime bugs, on every render, in CI, discovered only by re-executing
  // this exact file through Go's html/template rather than trusting a
  // smaller isolated snippet test. This count is the general guard: every
  // real action in this file is enumerated below, so a stray delimiter
  // anywhere else — in a comment, in new prose, in a future edit — fails
  // here instead of shipping.
  it("has exactly the double-brace delimiters this file is supposed to have, no more", () => {
    expect(html).toBeTruthy();
    const total = (html!.match(/\{\{/g) ?? []).length;
    // $locale:="", with .Data, $locale=print, end(with), if eq $locale"es",
    // else, end(if) = 7 control/variable actions, plus 5 .ConfirmationURL
    // output actions (4 functional + 1 quoted in the top comment, counted
    // in the test below) = 12.
    expect(total).toBe(12);
  });

  // The two runtime defects a real e2e run against the real local GoTrue
  // stack found, in order — see the file header above. Losing either guard
  // back out reintroduces a signInWithOtp()/signUp() failure that no amount
  // of "it looks right" review will catch without Docker.
  it("never reads .Data.preferred_locale directly, print-wrapped or not", () => {
    expect(html).not.toMatch(/eq \.Data\.preferred_locale "es"/);
    expect(html).not.toMatch(/eq \(print \.Data\.preferred_locale\) "es"/);
  });

  it("has both languages, in the right order (Spanish branch first)", () => {
    const ifIndex = html!.indexOf('if eq $locale "es"');
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

  // Subjects parse and execute as their own template, fully separate from
  // the body (confirmed by reading GoTrue's templatemailer/template.go), so
  // they need the same `with .Data` guard independently — the body's fix
  // does not cover them. Checked against the escaped-quote form TOML
  // actually stores on disk.
  it("wraps the subject's locale read in the same with-guard as the body", () => {
    expect(CONFIG).not.toMatch(/eq \.Data\.preferred_locale \\"es\\"/);
    expect(CONFIG).not.toMatch(/eq \(print \.Data\.preferred_locale\) \\"es\\"/);
    expect(
      CONFIG.match(/\{\{ with \.Data \}\}\{\{ \$locale = print \.preferred_locale \}\}\{\{ end \}\}/g) ?? [],
    ).toHaveLength(2);
    expect(CONFIG.match(/eq \$locale \\"es\\"/g) ?? []).toHaveLength(2);
  });
});
