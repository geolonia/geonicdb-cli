import { vi } from "vitest";
import { Command } from "commander";
import type { ClientResponse } from "../src/types.js";

/**
 * Create a mock GdbClient with all HTTP methods stubbed.
 */
export function createMockClient() {
  return {
    get: vi.fn<(...args: unknown[]) => Promise<ClientResponse>>(),
    post: vi.fn<(...args: unknown[]) => Promise<ClientResponse>>(),
    patch: vi.fn<(...args: unknown[]) => Promise<ClientResponse>>(),
    put: vi.fn<(...args: unknown[]) => Promise<ClientResponse>>(),
    delete: vi.fn<(...args: unknown[]) => Promise<ClientResponse>>(),
    rawRequest: vi.fn<(...args: unknown[]) => Promise<ClientResponse>>(),
  };
}

export type MockClient = ReturnType<typeof createMockClient>;

/**
 * Create a default successful response for mocking.
 */
export function mockResponse<T = unknown>(data: T, status = 200, count?: number): ClientResponse<T> {
  return {
    status,
    headers: new Headers(),
    data,
    count,
  };
}

/**
 * Build a Commander program with global options (matching cli.ts)
 * and register a single command group for testing.
 */
export function createTestProgram(
  registerFn: (program: Command) => void,
): Command {
  const program = new Command();
  program
    .name("geonic")
    .option("-u, --url <url>", "Base URL")
    .option("-s, --service <name>", "NGSILD-Tenant header")
    .option("--token <token>", "Authentication token")
    .option("-p, --profile <name>", "Profile")
    .option("--api-key <key>", "API key")
    .option("-f, --format <fmt>", "Output format")
    .option("--no-color", "Disable color")
    .option("-v, --verbose", "Verbose output")
    .exitOverride();

  registerFn(program);
  return program;
}

/**
 * Parse command args through a Commander program.
 * Prepends "geonic" as the program name and "node" as the executable.
 */
export async function runCommand(
  program: Command,
  args: string[],
): Promise<void> {
  await program.parseAsync(["node", "geonic", ...args]);
}
