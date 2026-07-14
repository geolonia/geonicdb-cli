/**
 * Shared vi.mock declarations for command test files.
 *
 * Import this file as a side-effect (`import "./setup-command-mocks.js"`)
 * before importing any source modules so that vitest intercepts the modules
 * with the standard mocks.
 *
 * Files that need additional mocks (e.g. resolveOptions, config, prompt)
 * should declare those vi.mock calls in their own file.
 */
import { vi } from "vitest";

vi.mock("../src/helpers.js", () => ({
  createClient: vi.fn(),
  getFormat: vi.fn(),
  outputResponse: vi.fn(),
  withErrorHandler: (fn: (...args: unknown[]) => unknown) => fn,
  parseNonNegativeInt: (value: string): number => {
    if (!/^\d+$/.test(value)) throw new Error("Invalid non-negative integer");
    return Number(value);
  },
  buildPaginationParams: (opts: { limit?: number; offset?: number }): Record<string, string> => {
    const params: Record<string, string> = {};
    if (opts.limit !== undefined) params["limit"] = String(opts.limit);
    if (opts.offset !== undefined) params["offset"] = String(opts.offset);
    return params;
  },
  // Single-request passthrough so command tests keep asserting on
  // client.rawRequest; the real page-following logic is unit-tested in
  // tests/helpers.test.ts against the unmocked implementation.
  fetchPaginatedList: async (
    client: { rawRequest: (method: string, path: string, options?: unknown) => Promise<unknown> },
    path: string,
    opts: { limit?: number; offset?: number },
    extraParams: Record<string, string> = {},
  ): Promise<unknown> => {
    const params: Record<string, string> = { ...extraParams };
    if (opts.limit !== undefined) params["limit"] = String(opts.limit);
    if (opts.offset !== undefined) params["offset"] = String(opts.offset);
    return client.rawRequest("GET", path, { params });
  },
}));

vi.mock("../src/input.js", () => ({
  parseJsonInput: vi.fn(),
}));

vi.mock("../src/output.js", () => ({
  printSuccess: vi.fn(),
  printError: vi.fn(),
  printInfo: vi.fn(),
  printWarning: vi.fn(),
  printOutput: vi.fn(),
  printCount: vi.fn(),
}));

vi.mock("../src/commands/help.js", () => ({
  addExamples: vi.fn(),
  addNotes: vi.fn(),
}));
