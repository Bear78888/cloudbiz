import { createServer, type Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  isTranscriptionConfigured,
  transcribeAudio,
  transcribeCost,
  transcribeModel,
} from "@/features/ai/transcribe";

/**
 * Against a real HTTP server, same reasoning as email-client.test.ts: what can
 * go wrong here is the mapping from a provider response to a decision (retry?
 * what does the owner see?), and a mocked fetch would let a wrong status code
 * pass unnoticed because the mock decides the shape.
 *
 * The server also parses the multipart body it receives, minimally — just
 * enough to assert the model, language and audio bytes this client sends are
 * the ones a real request would carry, without pulling in a parsing library
 * for a shape only this client ever needs to produce.
 */

interface ParsedMultipart {
  fields: Record<string, string>;
  files: Record<string, { filename: string; contentType: string; data: Buffer }>;
}

function parseMultipart(body: Buffer, contentType: string): ParsedMultipart {
  const boundaryMatch = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  const boundary = boundaryMatch ? (boundaryMatch[1] ?? boundaryMatch[2]) : null;
  const fields: Record<string, string> = {};
  const files: ParsedMultipart["files"] = {};
  if (!boundary) return { fields, files };

  const delimiter = Buffer.from(`--${boundary}`);
  const parts: Buffer[] = [];
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
      const typeMatch = /content-type:\s*([^\r\n]+)/i.exec(headerText);
      files[nameMatch[1]] = {
        filename: filenameMatch[1],
        contentType: typeMatch ? typeMatch[1].trim() : "application/octet-stream",
        data: content,
      };
    } else {
      fields[nameMatch[1]] = content.toString("utf8");
    }
  }
  return { fields, files };
}

let server: Server;
let base: string;
let lastRequest: { auth: string; parsed: ParsedMultipart } | null;
let handler: (parsed: ParsedMultipart) => { status: number; body: string };

beforeEach(async () => {
  lastRequest = null;
  handler = () => ({
    status: 200,
    body: JSON.stringify({ text: "Replace the water heater, forty gallon.", duration: 6.4 }),
  });

  server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      const parsed = parseMultipart(Buffer.concat(chunks), request.headers["content-type"] ?? "");
      lastRequest = { auth: request.headers.authorization ?? "", parsed };
      const result = handler(parsed);
      response.writeHead(result.status, { "content-type": "application/json" });
      response.end(result.body);
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  base = `http://127.0.0.1:${port}`;

  process.env.TRANSCRIBE_API_BASE = base;
  process.env.TRANSCRIBE_API_KEY = "test-key";
  delete process.env.TRANSCRIBE_MODEL;
});

afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  delete process.env.TRANSCRIBE_API_BASE;
  delete process.env.TRANSCRIBE_API_KEY;
  delete process.env.TRANSCRIBE_MODEL;
});

const AUDIO = { audio: Buffer.from("not really audio, just some bytes"), filename: "note.webm", mimeType: "audio/webm" };

describe("transcribing", () => {
  it("returns the transcript and its cost, computed from the provider's own duration", async () => {
    const result = await transcribeAudio(AUDIO);
    expect(result).toMatchObject({
      ok: true,
      text: "Replace the water heater, forty gallon.",
      usage: { model: "whisper-1", durationSeconds: 6.4 },
    });
    if (result.ok) {
      // 6.4s of whisper-1 at $0.006/minute.
      expect(result.usage.providerCost).toBeCloseTo((6.4 / 60) * 0.006, 10);
    }
  });

  it("sends the key, the model, the language and the audio bytes", async () => {
    await transcribeAudio({ ...AUDIO, language: "es" });

    expect(lastRequest!.auth).toBe("Bearer test-key");
    expect(lastRequest!.parsed.fields.model).toBe("whisper-1");
    expect(lastRequest!.parsed.fields.language).toBe("es");
    expect(lastRequest!.parsed.files.file?.filename).toBe("note.webm");
    expect(lastRequest!.parsed.files.file?.data.toString()).toBe(AUDIO.audio.toString());
  });

  it("omits the language field when none is given — the provider auto-detects", async () => {
    await transcribeAudio(AUDIO);
    expect(lastRequest!.parsed.fields.language).toBeUndefined();
  });

  it("respects TRANSCRIBE_MODEL", async () => {
    process.env.TRANSCRIBE_MODEL = "whisper-large";
    expect(transcribeModel()).toBe("whisper-large");
    await transcribeAudio(AUDIO);
    expect(lastRequest!.parsed.fields.model).toBe("whisper-large");
  });

  it("records a null cost for a model it does not have pricing for", async () => {
    process.env.TRANSCRIBE_MODEL = "whisper-large";
    const result = await transcribeAudio(AUDIO);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.usage.providerCost).toBeNull();
  });

  it("does not retry a rejected request", async () => {
    handler = () => ({ status: 400, body: JSON.stringify({ error: "bad request" }) });
    const result = await transcribeAudio(AUDIO);
    expect(result).toMatchObject({ ok: false, retryable: false });
  });

  it("does not retry a bad key", async () => {
    handler = () => ({ status: 401, body: "unauthorized" });
    expect(await transcribeAudio(AUDIO)).toMatchObject({ ok: false, retryable: false });
  });

  it("retries rate limiting and provider outages", async () => {
    handler = () => ({ status: 429, body: "slow down" });
    expect(await transcribeAudio(AUDIO)).toMatchObject({ ok: false, retryable: true });

    handler = () => ({ status: 503, body: "unavailable" });
    expect(await transcribeAudio(AUDIO)).toMatchObject({ ok: false, retryable: true });
  });

  it("retries when the network fails", async () => {
    process.env.TRANSCRIBE_API_BASE = "http://127.0.0.1:1";
    expect(await transcribeAudio(AUDIO)).toMatchObject({ ok: false, retryable: true });
  });

  // Silence is a real outcome, not an error worth retrying, but it is still
  // "nothing to hand the owner" — same treatment either way.
  it("treats an empty transcript as a non-retryable failure, cost intact", async () => {
    handler = () => ({ status: 200, body: JSON.stringify({ text: "  ", duration: 1.2 }) });
    const result = await transcribeAudio(AUDIO);
    expect(result).toMatchObject({ ok: false, retryable: false });
    expect(result.usage?.durationSeconds).toBe(1.2);
  });

  it("records a null duration and cost when the provider omits one", async () => {
    handler = () => ({ status: 200, body: JSON.stringify({ text: "Hello" }) });
    const result = await transcribeAudio(AUDIO);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.usage.durationSeconds).toBeNull();
      expect(result.usage.providerCost).toBeNull();
    }
  });
});

describe("configuration", () => {
  it("reports whether transcription can be attempted at all", () => {
    expect(isTranscriptionConfigured()).toBe(true);
    delete process.env.TRANSCRIBE_API_KEY;
    expect(isTranscriptionConfigured()).toBe(false);
  });

  it("refuses to call out without a key", async () => {
    delete process.env.TRANSCRIBE_API_KEY;
    expect(await transcribeAudio(AUDIO)).toEqual({
      ok: false,
      error: "transcription_not_configured",
      retryable: false,
      usage: null,
    });
  });
});

describe("cost", () => {
  it("is null for a model with no listed price", () => {
    expect(transcribeCost("unknown-model", 60)).toBeNull();
  });

  it("is null when the duration itself is unknown", () => {
    expect(transcribeCost("whisper-1", null)).toBeNull();
  });

  it("rounds to six places so a short clip doesn't record as zero", () => {
    expect(transcribeCost("whisper-1", 3)).toBe(0.0003);
  });
});
