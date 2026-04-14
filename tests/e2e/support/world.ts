import { World, setWorldConstructor, setDefaultTimeout } from "@cucumber/cucumber";
import { strict as assert } from "node:assert";
import { execFile } from "node:child_process";
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

setDefaultTimeout(30_000);

export const TEST_EMAIL = "admin@test.com";
export const TEST_PASSWORD = "SuperSecretPassword123!";
export const JWT_SECRET = "e2e-test-secret-key-minimum-32-characters-long";

export const TENANT_ADMIN_EMAIL = "tenant-admin@test.com";
export const TENANT_ADMIN_PASSWORD = "TenantAdmin123!";

export const PW_TEST_EMAIL = "pw-test@test.com";
export const PW_TEST_PASSWORD = "PwTestUser12345!";

export interface CliResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export class GdbWorld extends World {
  configDir!: string;
  lastResult!: CliResult;
  env: Record<string, string> = {};
  serverUrl!: string;

  /** Run the CLI with given arguments */
  async run(args: string[], extraEnv?: Record<string, string>, stdinData?: string): Promise<CliResult> {
    const cliPath = join(process.cwd(), "dist", "index.js");

    const env: Record<string, string> = {
      ...process.env as Record<string, string>,
      GEONIC_CONFIG_DIR: this.configDir,
      NO_COLOR: "1",
      ...this.env,
      ...extraEnv,
    };

    return new Promise((resolve) => {
      const child = execFile("node", [cliPath, ...args], { env, timeout: 15_000 }, (error, stdout, stderr) => {
        const result: CliResult = {
          stdout: stdout.toString().trim(),
          stderr: stderr.toString().trim(),
          exitCode: error ? (error as NodeJS.ErrnoException & { code?: number }).code ?? 1 : 0,
        };
        // execFile sets error.code to the exit code
        if (error && "code" in error && typeof error.code === "number") {
          result.exitCode = error.code;
        }
        this.lastResult = result;
        resolve(result);
      });
      if (stdinData !== undefined) {
        child.stdin?.write(stdinData);
      }
      child.stdin?.end();
    });
  }

  /** Create a temp config directory for this scenario */
  createConfigDir(): void {
    this.configDir = mkdtempSync(join(tmpdir(), "geonic-e2e-"));
  }

  /** Remove the temp config directory */
  cleanConfigDir(): void {
    if (this.configDir && existsSync(this.configDir)) {
      rmSync(this.configDir, { recursive: true, force: true });
    }
  }

  /** Write a config file in the temp config dir (auto-wraps v1 flat configs into v2 format) */
  writeConfig(config: Record<string, unknown>): void {
    mkdirSync(this.configDir, { recursive: true });
    // Ensure v2 format so the CLI doesn't need to auto-migrate (avoids extra file I/O)
    const toWrite = config.version === 2 ? config : {
      version: 2,
      currentProfile: "default",
      profiles: { default: config },
    };
    writeFileSync(join(this.configDir, "config.json"), JSON.stringify(toWrite, null, 2) + "\n");
  }

  /** Read the current config file (raw JSON) */
  readConfig(): Record<string, unknown> {
    const configPath = join(this.configDir, "config.json");
    if (!existsSync(configPath)) return {};
    return JSON.parse(readFileSync(configPath, "utf-8"));
  }

  /** Read the full config (v2-aware, returns raw structure) */
  readFullConfig(): Record<string, unknown> {
    return this.readConfig();
  }

  /** Read the active profile's config (v2-aware) */
  readProfileConfig(): Record<string, unknown> {
    const raw = this.readConfig();
    if (raw.profiles && typeof raw.profiles === "object") {
      const profiles = raw.profiles as Record<string, Record<string, unknown>>;
      const active = (raw.currentProfile as string) ?? "default";
      return profiles[active] ?? {};
    }
    return raw;
  }
}

setWorldConstructor(GdbWorld);

/**
 * Internal helper: login with given credentials and write the token to CLI config.
 * Retries up to 3 times to handle race conditions where the DB was just
 * cleared and the server hasn't yet recreated users.
 */
async function loginAs(world: GdbWorld, email: string, password: string): Promise<Record<string, unknown>> {
  const maxRetries = 3;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (attempt > 0) await sleep(200 * attempt);

    try {
      const loginUrl = new URL("/auth/login", world.serverUrl).toString();
      const res = await fetch(loginUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        lastError = new Error(`Login API call failed: HTTP ${res.status}`);
        continue;
      }
      const data = (await res.json()) as Record<string, unknown>;
      const token = (data.accessToken ?? data.token) as string;
      if (!token) {
        lastError = new Error("No token received from login API");
        continue;
      }

      const profile: Record<string, unknown> = { url: world.serverUrl, token };
      if (data.refreshToken) profile.refreshToken = data.refreshToken;
      world.writeConfig({
        version: 2,
        currentProfile: "default",
        profiles: { default: profile },
      });
      return world.readProfileConfig();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  assert.fail(lastError?.message ?? `loginAs(${email}) failed after retries`);
}

/**
 * Login as tenant admin (default for data API operations).
 */
export async function performLogin(world: GdbWorld): Promise<Record<string, unknown>> {
  return loginAs(world, TENANT_ADMIN_EMAIL, TENANT_ADMIN_PASSWORD);
}

/**
 * Login as super admin (for admin API operations).
 */
export async function performSuperAdminLogin(world: GdbWorld): Promise<Record<string, unknown>> {
  return loginAs(world, TEST_EMAIL, TEST_PASSWORD);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
