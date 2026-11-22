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
  multipart?: MultipartUpload;
}

interface MultipartUpload {
  partCount: number;
  partSizeBytes: number;
}

interface SignedParts {
  parts: { partNumber: number; upload: { url: string } }[];
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

function jobRequestOptions(timeoutMs: number) {
  return { headers: jsonHeaders, signal: AbortSignal.timeout(timeoutMs) };
}

export async function runImportJob(
  client: GdbClient,
  file: FileHandle,
  size: number,
  options: ImportJobOptions,
): Promise<void> {
  const requestOptions = () => jobRequestOptions(options.requestTimeoutMs);
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
    await uploadParts(client, path, data.multipart, file, size, options);
  } else {
    if (!data.upload?.url) {
      throw new Error(`Import job ${jobId} did not return an upload URL.`);
    }
    await putImportRange(
      data.upload.url,
      file,
      0,
      size,
      options.uploadTimeoutMs,
      "Import file",
      "application/x-ndjson",
    );
  }

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

async function uploadParts(
  client: GdbClient,
  path: string,
  multipart: MultipartUpload,
  file: FileHandle,
  size: number,
  options: ImportJobOptions,
): Promise<void> {
  const { partCount, partSizeBytes } = multipart;
  if (
    !Number.isSafeInteger(partSizeBytes) ||
    partSizeBytes <= 0 ||
    partCount !== Math.ceil(size / partSizeBytes) ||
    partCount > 10_000
  ) {
    throw new Error("Import job returned invalid multipart dimensions.");
  }

  // Sign each part immediately before streaming it, so slower connections
  // do not expire the remaining parts' URLs while uploading earlier parts.
  for (let partNumber = 1; partNumber <= partCount; partNumber++) {
    const { data } = await client.request<SignedParts>("POST", `${path}/upload-parts`, {
      ...jobRequestOptions(options.requestTimeoutMs),
      body: { partNumbers: [partNumber] },
    });
    const parts = data?.parts;
    const part = Array.isArray(parts) && parts.length === 1 ? parts[0] : undefined;
    if (
      part?.partNumber !== partNumber ||
      typeof part.upload?.url !== "string" ||
      !part.upload.url
    ) {
      throw new Error(`Import job did not return the URL for upload part ${partNumber}.`);
    }

    const offset = (partNumber - 1) * partSizeBytes;
    const length = Math.min(partSizeBytes, size - offset);
    await putImportRange(
      part.upload.url,
      file,
      offset,
      length,
      options.uploadTimeoutMs,
      `Import file part ${partNumber}`,
    );
  }
}

async function putImportRange(
  url: string,
  file: FileHandle,
  offset: number,
  length: number,
  timeoutMs: number,
  label: string,
  contentType?: string,
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

  const stream = file.createReadStream({
    start: offset,
    end: offset + length - 1,
    autoClose: false,
  });
  // A presigned URL is itself a credential. Use only upload headers, and
  // never print the target, follow redirects, or forward the broker token.
  const request = {
    method: "PUT",
    headers: {
      "Content-Length": String(length),
      ...(contentType && { "Content-Type": contentType }),
    },
    body: stream as unknown as RequestInit["body"],
    duplex: "half",
    redirect: "error",
    signal: AbortSignal.timeout(timeoutMs),
  } satisfies RequestInit & { duplex: "half" };
  try {
    const response = await fetch(target, request).catch(() => {
      throw new Error(`${label} upload failed. Check connectivity and the upload timeout.`);
    });
    await response.body?.cancel();
    if (!response.ok) throw new Error(`${label} upload failed (HTTP ${response.status}).`);
  } finally {
    if (!stream.readableEnded) stream.destroy();
  }
}
