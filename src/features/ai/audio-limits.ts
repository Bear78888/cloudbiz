/**
 * The voice note's size ceiling (§16.3), shared by the client form and the
 * server route/transcription client.
 *
 * Its own file, with no `server-only` guard, because the client component
 * needs to reject an oversized recording before ever uploading it — importing
 * this constant from `transcribe.ts` would pull in a server-only module and
 * fail the client bundle. Kept as one number rather than two copies that
 * could quietly drift apart.
 *
 * A voice note is a spoken job description, not a call recording — a couple
 * of minutes at most. 4 MB comfortably covers several minutes of compressed
 * speech audio (Opus/AAC) and stays under the request-body ceilings that
 * serverless platforms impose on a single function invocation.
 */
export const MAX_AUDIO_BYTES = 4 * 1024 * 1024;
