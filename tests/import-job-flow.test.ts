import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import type { IncomingHttpHeaders, Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { expect, it } from "vitest";

const run = promisify(execFile);
const api = "/ngsi-ld/v1/jobs/imports";
const input = '{"id":"urn:ngsi-ld:Room:1","type":"Room"}\n';

async function runImportCli(server: Server, dir: string, file: string) {
  await new Promise<void>((resolve, reject) =>
    server.listen(0, "127.0.0.1", resolve).once("error", reject),
  );
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected an HTTP port");
  return run(
    process.execPath,
    [
      "node_modules/tsx/dist/cli.mjs",
      "src/index.ts",
      "import",
      file,
      "--async",
      "--no-color",
      "--url",
      `http://127.0.0.1:${address.port}`,
      "--token",
      "broker-token",
      "--service",
      "import-tenant",
    ],
    { env: { ...process.env, HOME: dir }, timeout: 10_000 },
  ).then(
    ({ stdout, stderr }) => ({ stdout, stderr, code: 0 }),
    (err: { stdout: string; stderr: string; code: number | string }) => err,
  );
}

it.each([
  { finalState: "succeeded", uploadStatus: 200, exitCode: 0 },
  { finalState: "partially_failed", uploadStatus: 200, exitCode: 1 },
  { finalState: undefined, uploadStatus: 403, exitCode: 1 },
])(
  "imports through the job API (upload $uploadStatus, state $finalState)",
  async ({ finalState, uploadStatus, exitCode }) => {
    const dir = await mkdtemp(join(tmpdir(), "geonic-import-job-"));
    const requests: {
      method?: string;
      path?: string;
      headers: IncomingHttpHeaders;
      body: string;
    }[] = [];
    let statusCalls = 0;
    const server = createServer(async (req, res) => {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk);
      requests.push({
        method: req.method,
        path: req.url,
        headers: req.headers,
        body: Buffer.concat(chunks).toString(),
      });
      res.setHeader("Content-Type", "application/json");
      if (req.url === api) {
        res.writeHead(201).end(
          JSON.stringify({
            jobId: "job-1",
            upload: { url: `http://${req.headers.host}/object?signature=secret` },
          }),
        );
      } else if (req.url === "/object?signature=secret") {
        res.writeHead(uploadStatus).end();
      } else if (req.url === api + "/job-1/start") {
        res.writeHead(202).end("{}");
      } else if (req.url === api + "/job-1") {
        res.end(
          JSON.stringify({
            state: ++statusCalls === 1 ? "running" : finalState,
            progress: { created: 1 },
          }),
        );
      } else {
        res.writeHead(404).end("{}");
      }
    });

    try {
      const file = join(dir, "entities.ndjson");
      await writeFile(file, input);
      const result = await runImportCli(server, dir, file);

      const output = result.stdout + result.stderr;
      expect(result.code, output).toBe(exitCode);
      expect(output).toContain(finalState ?? "upload failed (HTTP 403)");
      expect(output).not.toContain("signature=secret");
      expect(requests.map(({ method, path }) => [method, path])).toEqual([
        ["POST", api],
        ["PUT", "/object?signature=secret"],
        ...(finalState
          ? [
              ["POST", api + "/job-1/start"],
              ["GET", api + "/job-1"],
              ["GET", api + "/job-1"],
            ]
          : []),
      ]);
      expect(JSON.parse(requests[0]!.body)).toEqual({
        operation: "upsert",
        format: "ndjson",
        declaredBytes: Buffer.byteLength(input),
      });
      const upload = requests[1]!;
      expect(upload.body).toBe(input);
      expect(upload.headers).toMatchObject({
        "content-length": String(Buffer.byteLength(input)),
        "content-type": "application/x-ndjson",
      });
      expect(upload.headers.authorization).toBeUndefined();
      expect(upload.headers["ngsild-tenant"]).toBeUndefined();
      for (const index of finalState ? [0, 2, 3, 4] : [0]) {
        expect(requests[index]!.headers).toMatchObject({
          authorization: "Bearer broker-token",
          "ngsild-tenant": "import-tenant",
        });
      }
    } finally {
      server.close();
      server.closeAllConnections();
      await rm(dir, { recursive: true, force: true });
    }
  },
  15_000,
);

it.each([
  { failedPart: 0, invalidCount: false, expectedMessage: "succeeded", expectedExitCode: 0 },
  {
    failedPart: 2,
    invalidCount: false,
    expectedMessage: "part 2 upload failed (HTTP 403)",
    expectedExitCode: 1,
  },
  {
    failedPart: 0,
    invalidCount: true,
    expectedMessage: "invalid multipart dimensions",
    expectedExitCode: 1,
  },
])(
  "streams numbered multipart ranges ($expectedMessage)",
  async ({ failedPart, invalidCount, expectedMessage, expectedExitCode }) => {
    const dir = await mkdtemp(join(tmpdir(), "geonic-import-parts-"));
    const bytes = Buffer.from('{"id":"urn:ngsi-ld:Room:1","type":"Room","name":"東京"}\n');
    const partSizeBytes = bytes.indexOf(Buffer.from("東京")) + 1;
    const partCount = Math.ceil(bytes.length / partSizeBytes);
    const requests: string[] = [];
    const presignBodies: unknown[] = [];
    const uploads: { headers: IncomingHttpHeaders; body: Buffer }[] = [];
    const server = createServer(async (req, res) => {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = Buffer.concat(chunks);
      requests.push(`${req.method} ${req.url}`);
      res.setHeader("Content-Type", "application/json");
      if (req.url === api) {
        res.writeHead(201).end(
          JSON.stringify({
            jobId: "multipart-job",
            multipart: {
              uploadId: "upload-1",
              partCount: invalidCount ? partCount - 1 : partCount,
              partSizeBytes,
            },
          }),
        );
      } else if (req.url === api + "/multipart-job/upload-parts") {
        const presignBody = JSON.parse(body.toString()) as { partNumbers: number[] };
        presignBodies.push(presignBody);
        res.end(
          JSON.stringify({
            parts: presignBody.partNumbers.map((partNumber) => ({
              partNumber,
              upload: { url: `http://${req.headers.host}/part/${partNumber}?signature=secret` },
            })),
          }),
        );
      } else if (req.url?.startsWith("/part/")) {
        uploads.push({ body, headers: req.headers });
        res.writeHead(req.url === `/part/${failedPart}?signature=secret` ? 403 : 200).end();
      } else if (req.url === api + "/multipart-job/start") {
        res.writeHead(202).end("{}");
      } else if (req.url === api + "/multipart-job") {
        res.end(JSON.stringify({ state: "succeeded" }));
      } else {
        res.writeHead(404).end("{}");
      }
    });

    try {
      const file = join(dir, "entities.ndjson");
      await writeFile(file, bytes);
      const result = await runImportCli(server, dir, file);

      const output = result.stdout + result.stderr;
      expect(result.code, output).toBe(expectedExitCode);
      expect(output).toContain(expectedMessage);
      expect(output).not.toContain("signature=secret");
      const lastPart = invalidCount ? 0 : failedPart || partCount;
      const expectedNumbers = Array.from({ length: lastPart }, (_, index) => index + 1);
      expect(presignBodies).toEqual(expectedNumbers.map((number) => ({ partNumbers: [number] })));
      expect(requests).toEqual([
        `POST ${api}`,
        ...expectedNumbers.flatMap((number) => [
          `POST ${api}/multipart-job/upload-parts`,
          `PUT /part/${number}?signature=secret`,
        ]),
        ...(expectedExitCode
          ? []
          : [`POST ${api}/multipart-job/start`, `GET ${api}/multipart-job`]),
      ]);
      expect(uploads.map(({ body }) => body)).toEqual(
        expectedNumbers.map((number) =>
          bytes.subarray((number - 1) * partSizeBytes, number * partSizeBytes),
        ),
      );
      for (const upload of uploads) {
        expect(upload.headers["content-length"]).toBe(String(upload.body.length));
        expect(upload.headers["content-type"]).toBeUndefined();
        expect(upload.headers.authorization).toBeUndefined();
      }
    } finally {
      server.close();
      server.closeAllConnections();
      await rm(dir, { recursive: true, force: true });
    }
  },
  15_000,
);

it.skipIf(process.platform === "win32")(
  "rejects a FIFO with no writer without waiting",
  async () => {
    const dir = await mkdtemp(join(tmpdir(), "geonic-import-fifo-"));
    try {
      const file = join(dir, "entities.ndjson");
      await run("mkfifo", [file]);
      await expect(
        run(
          process.execPath,
          [
            "node_modules/tsx/dist/cli.mjs",
            "src/index.ts",
            "import",
            file,
            "--async",
            "--dry-run",
            "--no-color",
          ],
          { env: { ...process.env, HOME: dir }, timeout: 5_000 },
        ),
      ).rejects.toMatchObject({
        code: 1,
        stderr: expect.stringContaining("--async requires a non-empty regular NDJSON file."),
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  },
  8_000,
);
