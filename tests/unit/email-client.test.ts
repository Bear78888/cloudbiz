import { createServer, type Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { isEmailConfigured, sendEmail } from "@/features/email/client";

/**
 * The client against a real HTTP server rather than a mocked `fetch`.
 *
 * What can go wrong here is the mapping from a provider response to a decision:
 * whether to retry, and whether the owner is told it failed. A mocked fetch
 * would let a wrong status code pass unnoticed because the mock decides the
 * shape; a socket does not.
 */

let server: Server;
let base: string;
let handler: (request: { body: string; auth: string }) => {
  status: number;
  body: string;
};

beforeEach(async () => {
  handler = () => ({ status: 200, body: JSON.stringify({ id: "msg_1" }) });

  server = createServer((request, response) => {
    let raw = "";
    request.on("data", (chunk) => {
      raw += chunk;
    });
    request.on("end", () => {
      const result = handler({ body: raw, auth: request.headers.authorization ?? "" });
      response.writeHead(result.status, { "content-type": "application/json" });
      response.end(result.body);
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  base = `http://127.0.0.1:${port}`;

  process.env.RESEND_API_BASE = base;
  process.env.RESEND_API_KEY = "test-key";
  process.env.RESEND_FROM_EMAIL = "noreply@handyalliance.test";
});

afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  delete process.env.RESEND_API_BASE;
  delete process.env.RESEND_API_KEY;
  delete process.env.RESEND_FROM_EMAIL;
});

const MESSAGE = {
  to: "customer@example.test",
  subject: "Your estimate",
  html: "<p>hi</p>",
  text: "hi",
};

describe("sending", () => {
  it("returns the provider's message id", async () => {
    const result = await sendEmail(MESSAGE);
    expect(result).toEqual({ ok: true, providerMessageId: "msg_1" });
  });

  it("sends the key and the message the provider expects", async () => {
    let seen: { body: string; auth: string } | null = null;
    handler = (request) => {
      seen = request;
      return { status: 200, body: JSON.stringify({ id: "msg_2" }) };
    };

    await sendEmail({ ...MESSAGE, replyTo: "pro@example.test" });

    expect(seen!.auth).toBe("Bearer test-key");
    const body = JSON.parse(seen!.body);
    expect(body.to).toEqual(["customer@example.test"]);
    expect(body.from).toBe("noreply@handyalliance.test");
    expect(body.reply_to).toEqual(["pro@example.test"]);
    expect(body.text).toBe("hi");
  });

  it("omits reply_to when there is none rather than sending null", async () => {
    let seen = "";
    handler = (request) => {
      seen = request.body;
      return { status: 200, body: JSON.stringify({ id: "msg_3" }) };
    };
    await sendEmail(MESSAGE);
    expect(JSON.parse(seen)).not.toHaveProperty("reply_to");
  });
});

describe("what is worth trying again", () => {
  // A rejected address will be rejected again. Retrying it forever would hide a
  // fact the owner needs to act on.
  it("does not retry a rejected message", async () => {
    handler = () => ({ status: 422, body: JSON.stringify({ message: "invalid address" }) });
    const result = await sendEmail(MESSAGE);
    expect(result).toMatchObject({ ok: false, retryable: false });
    if (!result.ok) expect(result.error).toContain("422");
  });

  it("does not retry a bad key", async () => {
    handler = () => ({ status: 401, body: "unauthorized" });
    expect(await sendEmail(MESSAGE)).toMatchObject({ ok: false, retryable: false });
  });

  it("retries rate limiting and provider outages", async () => {
    handler = () => ({ status: 429, body: "slow down" });
    expect(await sendEmail(MESSAGE)).toMatchObject({ ok: false, retryable: true });

    handler = () => ({ status: 503, body: "unavailable" });
    expect(await sendEmail(MESSAGE)).toMatchObject({ ok: false, retryable: true });
  });

  it("retries when the network fails", async () => {
    process.env.RESEND_API_BASE = "http://127.0.0.1:1";
    expect(await sendEmail(MESSAGE)).toMatchObject({ ok: false, retryable: true });
  });

  // Accepted with no id leaves a message no delivery webhook can ever match
  // (§17.10). Better a visible failure than an untrackable success.
  it("treats an accepted message with no id as a failure", async () => {
    handler = () => ({ status: 200, body: JSON.stringify({ ok: true }) });
    const result = await sendEmail(MESSAGE);
    expect(result).toMatchObject({ ok: false, retryable: false });
    if (!result.ok) expect(result.error).toContain("without an id");
  });

  // The error string is stored and shown to the owner.
  it("does not paste an entire provider error page into the record", async () => {
    handler = () => ({ status: 500, body: "x".repeat(5000) });
    const result = await sendEmail(MESSAGE);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.length).toBeLessThan(320);
  });
});

describe("configuration", () => {
  it("reports whether email can be sent at all", () => {
    expect(isEmailConfigured()).toBe(true);
    delete process.env.RESEND_API_KEY;
    expect(isEmailConfigured()).toBe(false);
  });

  it("refuses to send without a key instead of calling out", async () => {
    delete process.env.RESEND_API_KEY;
    expect(await sendEmail(MESSAGE)).toEqual({
      ok: false,
      error: "email_not_configured",
      retryable: false,
    });
  });
});
