import { setTimeout as delay } from "node:timers/promises";
import type { FileHandle } from "node:fs/promises";
import type { GdbClient } from "./client.js";
import { sanitizeServerText } from "./sanitize.js";

const jobsPath = "/jobs/imports";
const pollIntervalMs = 1_000;
const jsonHeaders = { "Content-Type": "application/json", Accept: "application/json" };

interface CreatedJob {
  jobId: string;
  upload?: { url: string };
  multipart?: unknown;
}

interface JobStatus {
  state: string;
  progress?: {
    read: number;
    created: number;
    updated: number;
    failed: number;
  };
}

export interface ImportJobOptions {
  requestTimeoutMs: number;
  uploadTimeoutMs: number;
  report: (message: string) => void;
}

export async function runImportJob(
  client: GdbClient,
  file: FileHandle,
  size: number,
  options: ImportJobOptions,
): Promise<void> {
  const requestOptions = () => ({
    headers: jsonHeaders,
    signal: AbortSignal.timeout(options.requestTimeoutMs),
  });
  const { data } = await client.request<CreatedJob>("POST", jobsPath, {
    ...requestOptions(),
    body: { operation: "upsert", format: "ndjson", declaredBytes: size },
  });
  if (typeof data?.jobId !== "string" || !data.jobId || data.jobId === "." || data.jobId === "..") {
    throw new Error("Import job response did not contain a valid job ID.");
  }

  const jobId = sanitizeServerText(data.jobId);
  options.report(`Import job created: ${jobId}`);
  const path = `${jobsPath}/${encodeURIComponent(data.jobId)}`;
  if (data.multipart) {
    throw new Error(
      `Import job ${jobId} requires multipart upload, which this CLI version does not support.`,
    );
  }
  if (!data.upload?.url) {
    throw new Error(`Import job ${jobId} did not return an upload URL.`);
  }
  await putImportFile(data.upload.url, file, size, options.uploadTimeoutMs);

  await client.request("POST", `${path}/start`, requestOptions());
  for (;;) {
    const { data: status } = await client.request<JobStatus>("GET", path, requestOptions());
    switch (status?.state) {
      case "succeeded": {
        const progress = status.progress;
        const summary = progress
          ? ` (created=${progress.created}, updated=${progress.updated})`
          : "";
        options.report(`Import job ${jobId}: succeeded${summary}.`);
        return;
      }
      case "partially_failed":
      case "failed":
      case "cancelled":
        throw new Error(`Import job ${jobId}: ${status.state}.`);
      case "created":
      case "uploaded":
      case "queued":
      case "running":
        await delay(pollIntervalMs);
        break;
      default:
        throw new Error(`Import job ${jobId} returned an unknown state.`);
    }
  }
}

async function putImportFile(
  url: string,
  file: FileHandle,
  size: number,
  timeoutMs: number,
): Promise<void> {
  const target = URL.canParse(url) ? new URL(url) : undefined;
  if (
    !target ||
    !["https:", "http:"].includes(target.protocol) ||
    target.username ||
    target.password
  ) {
    throw new Error("Import job upload requires an HTTP(S) URL without embedded credentials.");
  }

  const stream = file.createReadStream({ start: 0, end: size - 1, autoClose: false });
  // A presigned URL is itself a credential. Use only upload headers, and
  // never print the target, follow redirects, or forward the broker token.
  const request = {
    method: "PUT",
    headers: { "Content-Type": "application/x-ndjson", "Content-Length": String(size) },
    body: stream as unknown as RequestInit["body"],
    duplex: "half",
    redirect: "error",
    signal: AbortSignal.timeout(timeoutMs),
  } satisfies RequestInit & { duplex: "half" };
  try {
    const response = await fetch(target, request).catch(() => {
      throw new Error("Import file upload failed. Check connectivity and the upload timeout.");
    });
    await response.body?.cancel();
    if (!response.ok) throw new Error(`Import file upload failed (HTTP ${response.status}).`);
  } finally {
    if (!stream.readableEnded) stream.destroy();
  }
}
