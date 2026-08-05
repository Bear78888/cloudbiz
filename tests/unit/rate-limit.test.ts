import { beforeEach, describe, expect, it } from "vitest";

import { clientKey, rateLimit, resetRateLimits } from "@/lib/rate-limit";

describe("rate limit", () => {
  beforeEach(() => resetRateLimits());

  it("allows up to the limit and refuses after", () => {
    for (let i = 0; i < 5; i += 1) {
      expect(rateLimit("k", 5, 60_000).allowed).toBe(true);
    }
    expect(rateLimit("k", 5, 60_000).allowed).toBe(false);
  });

  it("counts each caller separately", () => {
    for (let i = 0; i < 5; i += 1) rateLimit("a", 5, 60_000);
    expect(rateLimit("a", 5, 60_000).allowed).toBe(false);
    expect(rateLimit("b", 5, 60_000).allowed).toBe(true);
  });

  it("reports what is left", () => {
    expect(rateLimit("k", 3, 60_000).remaining).toBe(2);
    expect(rateLimit("k", 3, 60_000).remaining).toBe(1);
    expect(rateLimit("k", 3, 60_000).remaining).toBe(0);
  });

  // A window of zero is already over, so the next call starts a fresh one.
  it("forgets a caller once their window has passed", () => {
    expect(rateLimit("k", 1, 0).allowed).toBe(true);
    expect(rateLimit("k", 1, 0).allowed).toBe(true);
  });
});

describe("client key", () => {
  it("takes the leftmost forwarded address", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.7, 70.41.3.18, 150.172.238.178" });
    expect(clientKey(headers)).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip, then to a constant", () => {
    expect(clientKey(new Headers({ "x-real-ip": "198.51.100.4" }))).toBe("198.51.100.4");
    expect(clientKey(new Headers())).toBe("unknown");
  });

  // Everyone behind a proxy that strips the header shares one bucket. That is
  // a worse experience under load, not a hole: the key is never an identity.
  it("never returns an empty key, which would merge every caller silently", () => {
    expect(clientKey(new Headers({ "x-forwarded-for": "" }))).toBe("unknown");
    expect(clientKey(new Headers({ "x-forwarded-for": "  ,  " }))).toBe("unknown");
  });
});
