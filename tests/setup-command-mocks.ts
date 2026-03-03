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
}));
