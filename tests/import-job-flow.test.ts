import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import type { IncomingHttpHeaders } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { expect, it } from "vitest";

const run = promisify(execFile);
const api = "/ngsi-ld/v1/jobs/imports";
const input = '{"id":"urn:ngsi-ld:Room:1","type":"Room"}\n';

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
        res
          .writeHead(201)
          .end(
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
      await new Promise<void>((resolve, reject) =>
        server.listen(0, "127.0.0.1", resolve).once("error", reject),
      );
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Expected an HTTP port");
      const result = await run(
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
