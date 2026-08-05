#!/usr/bin/env node
/**
 * A stand-in for Resend's send endpoint, used by the end-to-end run.
 *
 * It exists so the suite can assert on **what was actually sent** — that a
 * message went at all, to which address, in which language, and carrying a link
 * that opens the estimate. Asserting "the button said Sent" would pass just as
 * well with no email leaving the building, which is the class of defect the
 * Sheets stub was written to catch and the same one applies here.
 *
 * It imitates Resend only as far as our client uses it: POST /emails, a bearer
 * token, and an `{ id }` back. This is not a Resend simulator and must not grow
 * into one — it checks our behaviour, not the provider's.
 *
 * State is written to `$RESEND_STUB_STATE` so the spec can read the outbox.
 * `POST /__stub/fail-next` makes the next send fail, so the failure path can be
 * exercised without breaking anything real.
 */

import { createServer } from "node:http";
import { writeFileSync } from "node:fs";

const PORT = Number(process.env.RESEND_STUB_PORT ?? 4546);
const STATE_PATH = process.env.RESEND_STUB_STATE ?? "/tmp/resend-stub.json";

const outbox = [];
let failNext = false;
let counter = 0;

function persist() {
  writeFileSync(STATE_PATH, JSON.stringify(outbox, null, 2));
}

function readBody(request) {
  return new Promise((resolve) => {
    let raw = "";
    request.on("data", (chunk) => {
      raw += chunk;
    });
    request.on("end", () => resolve(raw));
  });
}

function send(response, status, payload) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(payload));
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://127.0.0.1:${PORT}`);

  if (url.pathname === "/__stub/health") return send(response, 200, { ok: true });

  if (url.pathname === "/__stub/fail-next" && request.method === "POST") {
    failNext = true;
    return send(response, 200, { ok: true });
  }

  if (url.pathname === "/__stub/outbox") return send(response, 200, outbox);

  if (url.pathname === "/emails" && request.method === "POST") {
    // The real API refuses an unauthenticated call; so does this, because a
    // client that forgot the key should fail here rather than pass silently.
    const auth = request.headers.authorization ?? "";
    if (!auth.startsWith("Bearer ") || auth.length < 10) {
      return send(response, 401, { message: "missing api key" });
    }

    if (failNext) {
      failNext = false;
      return send(response, 422, { message: "stubbed failure" });
    }

    const body = JSON.parse((await readBody(request)) || "{}");
    counter += 1;
    const id = `stub-message-${counter}`;
    outbox.push({
      id,
      from: body.from,
      to: Array.isArray(body.to) ? body.to[0] : body.to,
      subject: body.subject,
      html: body.html,
      text: body.text,
      receivedAt: new Date().toISOString(),
    });
    persist();
    return send(response, 200, { id });
  }

  send(response, 404, { message: "not found" });
});

server.listen(PORT, "127.0.0.1", () => {
  persist();
  console.log(`[resend-stub] listening on ${PORT}, state at ${STATE_PATH}`);
});
