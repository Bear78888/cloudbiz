#!/usr/bin/env node
/**
 * A stand-in for the speech-to-text provider, used by the end-to-end run.
 *
 * Same reasoning as ai-stub.mjs: no test calls a real provider, and what the
 * suite needs to check is our behaviour around it — that a transcript lands
 * in the description field for the owner to read and edit, that a daily cap
 * exists, that a failure changes nothing. The stub parses the multipart body
 * just enough to prove the client sent a real file and the fields a real
 * request would carry (model, language) — not a general-purpose parser, only
 * what this one client ever produces.
 *
 * `POST /__stub/reply` sets the next transcript (and optional duration).
 * `POST /__stub/fail-next` makes the next call return 500.
 * `GET  /__stub/requests` returns what was received, most recent last.
 */

import { createServer } from "node:http";
import { writeFileSync } from "node:fs";

const PORT = Number(process.env.TRANSCRIBE_STUB_PORT ?? 4548);
const STATE_PATH = process.env.TRANSCRIBE_STUB_STATE ?? "/tmp/transcribe-stub.json";

const requests = [];
let failNext = false;
let nextReply = { text: "Replace the water heater, forty gallon, in the garage.", duration: 5.2 };

function persist() {
  writeFileSync(STATE_PATH, JSON.stringify(requests, null, 2));
}

function readBody(request) {
  return new Promise((resolve) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

function parseMultipart(body, contentType) {
  const boundaryMatch = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || "");
  const boundary = boundaryMatch ? boundaryMatch[1] ?? boundaryMatch[2] : null;
  const fields = {};
  const files = {};
  if (!boundary) return { fields, files };

  const delimiter = Buffer.from(`--${boundary}`);
  const parts = [];
  let start = body.indexOf(delimiter);
  while (start !== -1) {
    const next = body.indexOf(delimiter, start + delimiter.length);
    if (next === -1) break;
    parts.push(body.subarray(start + delimiter.length, next));
    start = next;
  }

  for (const part of parts) {
    const headerEnd = part.indexOf("\r\n\r\n");
    if (headerEnd === -1) continue;
    const headerText = part.subarray(0, headerEnd).toString("latin1");
    let content = part.subarray(headerEnd + 4);
    if (content.subarray(content.length - 2).toString("latin1") === "\r\n") {
      content = content.subarray(0, content.length - 2);
    }
    const nameMatch = /name="([^"]+)"/.exec(headerText);
    if (!nameMatch) continue;
    const filenameMatch = /filename="([^"]*)"/.exec(headerText);
    if (filenameMatch) {
      files[nameMatch[1]] = { filename: filenameMatch[1], size: content.length };
    } else {
      fields[nameMatch[1]] = content.toString("utf8");
    }
  }
  return { fields, files };
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
    const raw = await readBody(request);
    nextReply = JSON.parse(raw.toString("utf8") || "{}");
    return send(response, 200, { ok: true });
  }

  if (url.pathname === "/__stub/fail-next" && request.method === "POST") {
    failNext = true;
    return send(response, 200, { ok: true });
  }

  if (url.pathname === "/v1/audio/transcriptions" && request.method === "POST") {
    if (!request.headers.authorization) {
      return send(response, 401, { error: { message: "missing api key" } });
    }

    const body = await readBody(request);
    const { fields, files } = parseMultipart(body, request.headers["content-type"]);
    requests.push({
      model: fields.model,
      language: fields.language ?? null,
      responseFormat: fields.response_format,
      file: files.file ?? null,
      receivedAt: new Date().toISOString(),
    });
    persist();

    if (failNext) {
      failNext = false;
      return send(response, 500, { error: { message: "stubbed provider failure" } });
    }

    return send(response, 200, nextReply);
  }

  send(response, 404, { error: { message: "not found" } });
});

server.listen(PORT, "127.0.0.1", () => {
  persist();
  console.log(`[transcribe-stub] listening on ${PORT}, state at ${STATE_PATH}`);
});
