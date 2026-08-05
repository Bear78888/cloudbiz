#!/usr/bin/env node
/**
 * A stand-in for the Anthropic Messages API, used by the end-to-end run.
 *
 * No test calls a real model: it would be slow, cost money, and be differently
 * wrong on every run — which is the opposite of what a test is for. What the
 * suite actually needs to check is *our* behaviour around the model, and that
 * needs a response we choose.
 *
 * It also records what was sent, so the spec can assert the thing that matters
 * for §27.3: the customer's words arrive as delimited data in the user message,
 * and the instructions are in `system`. A prompt-injection defence nobody
 * inspects is a hope, and this is how it gets inspected end to end.
 *
 * `POST /__stub/reply` sets the next response body.
 * `POST /__stub/fail-next` makes the next call return 500.
 * `GET  /__stub/requests` returns what we sent.
 */

import { createServer } from "node:http";
import { writeFileSync } from "node:fs";

const PORT = Number(process.env.AI_STUB_PORT ?? 4547);
const STATE_PATH = process.env.AI_STUB_STATE ?? "/tmp/ai-stub.json";

const requests = [];
let failNext = false;

/** A believable draft, used until a test says otherwise. */
let nextReply = JSON.stringify({
  scope: "Replace the leaking water heater and haul away the old unit.",
  items: [
    { item_type: "labor", description: "Installation, 3 hours", quantity: 3, unit_price: 95 },
    { item_type: "material", description: "40-gallon water heater", quantity: 1, unit_price: 780 },
  ],
  confidence: 0.82,
  assumptions: ["Standard 40-gallon tank", "Existing connections are to code"],
});

function persist() {
  writeFileSync(STATE_PATH, JSON.stringify(requests, null, 2));
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
  if (url.pathname === "/__stub/requests") return send(response, 200, requests);

  if (url.pathname === "/__stub/reply" && request.method === "POST") {
    nextReply = await readBody(request);
    return send(response, 200, { ok: true });
  }

  if (url.pathname === "/__stub/fail-next" && request.method === "POST") {
    failNext = true;
    return send(response, 200, { ok: true });
  }

  if (url.pathname === "/v1/messages" && request.method === "POST") {
    if (!request.headers["x-api-key"]) {
      return send(response, 401, { error: { message: "missing api key" } });
    }

    const body = JSON.parse((await readBody(request)) || "{}");
    requests.push({
      model: body.model,
      system: body.system,
      user: body.messages?.[0]?.content ?? "",
      receivedAt: new Date().toISOString(),
    });
    persist();

    if (failNext) {
      failNext = false;
      return send(response, 500, { error: { message: "stubbed model failure" } });
    }

    return send(response, 200, {
      content: [{ type: "text", text: nextReply }],
      usage: { input_tokens: 420, output_tokens: 180 },
    });
  }

  send(response, 404, { error: { message: "not found" } });
});

server.listen(PORT, "127.0.0.1", () => {
  persist();
  console.log(`[ai-stub] listening on ${PORT}, state at ${STATE_PATH}`);
});
