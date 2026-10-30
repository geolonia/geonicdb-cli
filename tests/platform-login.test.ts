import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  maskSigV4Headers,
  regionFromAwsConfig,
  resolveAwsRegion,
  requestPlatformToken,
  defaultSignRequest,
  parsePlatformTokenResponse,
  stripIniInlineComment,
  normalizeIniSectionName,
  assertValidAwsRegion,
  PlatformLoginError,
  PLATFORM_TOKEN_FORBIDDEN_MESSAGE,
} from "../src/platform-login.js";

describe("platform-login helpers", () => {
  const prevRegion = process.env.AWS_REGION;
  const prevDefaultRegion = process.env.AWS_DEFAULT_REGION;
  const prevProfile = process.env.AWS_PROFILE;
  const prevConfigFile = process.env.AWS_CONFIG_FILE;
  const prevAccessKey = process.env.AWS_ACCESS_KEY_ID;
  const prevSecretKey = process.env.AWS_SECRET_ACCESS_KEY;
  const prevSession = process.env.AWS_SESSION_TOKEN;
  let tmpDir: string | undefined;

  beforeEach(() => {
    delete process.env.AWS_REGION;
    delete process.env.AWS_DEFAULT_REGION;
    delete process.env.AWS_PROFILE;
    delete process.env.AWS_CONFIG_FILE;
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    delete process.env.AWS_SESSION_TOKEN;
  });

  afterEach(() => {
    if (prevRegion === undefined) delete process.env.AWS_REGION;
    else process.env.AWS_REGION = prevRegion;
    if (prevDefaultRegion === undefined) delete process.env.AWS_DEFAULT_REGION;
    else process.env.AWS_DEFAULT_REGION = prevDefaultRegion;
    if (prevProfile === undefined) delete process.env.AWS_PROFILE;
    else process.env.AWS_PROFILE = prevProfile;
    if (prevConfigFile === undefined) delete process.env.AWS_CONFIG_FILE;
    else process.env.AWS_CONFIG_FILE = prevConfigFile;
    if (prevAccessKey === undefined) delete process.env.AWS_ACCESS_KEY_ID;
    else process.env.AWS_ACCESS_KEY_ID = prevAccessKey;
    if (prevSecretKey === undefined) delete process.env.AWS_SECRET_ACCESS_KEY;
    else process.env.AWS_SECRET_ACCESS_KEY = prevSecretKey;
    if (prevSession === undefined) delete process.env.AWS_SESSION_TOKEN;
    else process.env.AWS_SESSION_TOKEN = prevSession;
    if (tmpDir) {
      rmSync(tmpDir, { recursive: true, force: true });
      tmpDir = undefined;
    }
  });

  function writeAwsConfig(contents: string): string {
    tmpDir = mkdtempSync(join(tmpdir(), "geonic-aws-config-"));
    const path = join(tmpDir, "config");
    writeFileSync(path, contents, "utf-8");
    process.env.AWS_CONFIG_FILE = path;
    return path;
  }

  describe("INI helpers (L2)", () => {
    it("strips inline # and ; comments", () => {
      expect(stripIniInlineComment("region = ap-northeast-1 # tokyo")).toBe(
        "region = ap-northeast-1",
      );
      expect(stripIniInlineComment("region = us-west-2; west")).toBe("region = us-west-2");
    });

    it("normalizes section name whitespace", () => {
      expect(normalizeIniSectionName("profile  ops")).toBe("profile ops");
      expect(normalizeIniSectionName("  default  ")).toBe("default");
    });

    it("reads region with inline comment and [profile  name] spacing", () => {
      writeAwsConfig("[profile  ops]\nregion = ap-northeast-3 # primary\n");
      expect(regionFromAwsConfig("ops")).toBe("ap-northeast-3");
    });

    it("ignores oversized aws config files", () => {
      tmpDir = mkdtempSync(join(tmpdir(), "geonic-aws-config-"));
      const path = join(tmpDir, "config");
      writeFileSync(path, "x".repeat(1_048_577), "utf-8");
      process.env.AWS_CONFIG_FILE = path;
      expect(regionFromAwsConfig("default")).toBeUndefined();
    });
  });

  describe("assertValidAwsRegion (L5)", () => {
    it("accepts canonical region ids", () => {
      expect(assertValidAwsRegion("ap-northeast-1")).toBe("ap-northeast-1");
    });

    it("rejects uppercase / underscores / spaces (near-miss)", () => {
      expect(() => assertValidAwsRegion("AP-NORTHEAST-1")).toThrow(/Invalid AWS region/);
      expect(() => assertValidAwsRegion("ap_northeast_1")).toThrow(/Invalid AWS region/);
      expect(() => assertValidAwsRegion("ap-northeast-1 ")).toThrow(/Invalid AWS region/);
    });
  });

  describe("resolveAwsRegion", () => {
    it("prefers --aws-region over AWS_REGION and profile", () => {
      process.env.AWS_REGION = "us-east-1";
      writeAwsConfig("[default]\nregion = eu-west-1\n");
      expect(resolveAwsRegion({ awsRegion: "ap-northeast-1" })).toBe("ap-northeast-1");
    });

    it("uses AWS_REGION when --aws-region is absent", () => {
      process.env.AWS_REGION = "ap-northeast-1";
      writeAwsConfig("[default]\nregion = eu-west-1\n");
      expect(resolveAwsRegion({})).toBe("ap-northeast-1");
    });

    it("falls back to profile region", () => {
      writeAwsConfig("[profile ops]\nregion = ap-northeast-3\n");
      expect(resolveAwsRegion({ awsProfile: "ops" })).toBe("ap-northeast-3");
    });

    it("fail-fast when region cannot be resolved", () => {
      writeAwsConfig("[default]\noutput = json\n");
      expect(() => resolveAwsRegion({})).toThrow(/AWS region is required/);
    });

    // Near-miss: AWS_DEFAULT_REGION alone must NOT satisfy DESIGN's AWS_REGION slot.
    it("ignores AWS_DEFAULT_REGION (near-miss)", () => {
      process.env.AWS_DEFAULT_REGION = "ap-northeast-1";
      writeAwsConfig("[default]\noutput = json\n");
      expect(() => resolveAwsRegion({})).toThrow(/AWS region is required/);
    });

    it("rejects invalid characters after resolution", () => {
      process.env.AWS_REGION = "AP-NORTHEAST-1";
      expect(() => resolveAwsRegion({})).toThrow(/Invalid AWS region/);
    });
  });

  describe("regionFromAwsConfig", () => {
    it("reads default section without profile prefix", () => {
      writeAwsConfig("[default]\nregion = ap-northeast-1\n");
      expect(regionFromAwsConfig("default")).toBe("ap-northeast-1");
    });

    it("reads named profile section", () => {
      writeAwsConfig("[profile staging]\nregion = us-west-2\n");
      expect(regionFromAwsConfig("staging")).toBe("us-west-2");
    });
  });

  describe("maskSigV4Headers", () => {
    it("masks Authorization starting with AWS4-HMAC-SHA256", () => {
      const masked = maskSigV4Headers({
        authorization:
          "AWS4-HMAC-SHA256 Credential=AKIA.../20260101/ap-northeast-1/execute-api/aws4_request, Signature=deadbeef",
        "content-type": "application/json",
      });
      expect(masked.authorization).toBe("AWS4-HMAC-SHA256 <redacted>");
      expect(masked["content-type"]).toBe("application/json");
    });

    // Near-miss: Bearer must not be rewritten as if it were SigV4.
    it("does not mask Bearer Authorization (near-miss)", () => {
      const masked = maskSigV4Headers({
        authorization: "Bearer eyJhbGciOiJIUzI1NiJ9.payload.sig",
      });
      expect(masked.authorization).toBe("Bearer eyJhbGciOiJIUzI1NiJ9.payload.sig");
    });

    it("masks x-amz-security-token", () => {
      const masked = maskSigV4Headers({
        "x-amz-security-token": "session-token-value",
      });
      expect(masked["x-amz-security-token"]).toBe("<redacted>");
    });
  });

  describe("parsePlatformTokenResponse (L1)", () => {
    const valid = {
      accessToken: "plat-token",
      expiresIn: 900,
      tokenType: "Bearer",
      user: { id: "arn:aws:iam::1:user/x", role: "platform_admin", tenantId: null },
    };

    it("accepts a valid body", () => {
      expect(parsePlatformTokenResponse(valid).accessToken).toBe("plat-token");
    });

    it("allows missing expiresIn", () => {
      const { expiresIn, ...rest } = valid;
      void expiresIn;
      expect(parsePlatformTokenResponse(rest).expiresIn).toBeUndefined();
    });

    it("rejects non-string accessToken / wrong tokenType / wrong role", () => {
      expect(() => parsePlatformTokenResponse({ ...valid, accessToken: 1 })).toThrow(/accessToken/);
      expect(() => parsePlatformTokenResponse({ ...valid, tokenType: "bearer" })).toThrow(/tokenType/);
      expect(() =>
        parsePlatformTokenResponse({ ...valid, user: { ...valid.user, role: "super_admin" } }),
      ).toThrow(/platform_admin/);
    });
  });

  describe("defaultSignRequest (L3)", () => {
    it("signs with host, x-amz-date, and execute-api credential scope for region", async () => {
      process.env.AWS_ACCESS_KEY_ID = "AKIAIOSFODNN7EXAMPLE";
      process.env.AWS_SECRET_ACCESS_KEY = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";
      const url = new URL(
        "https://example.execute-api.ap-northeast-1.amazonaws.com/prod/auth/platform-token",
      );
      const headers = await defaultSignRequest({ url, region: "ap-northeast-1" });
      const auth = headers.authorization ?? headers.Authorization;
      expect(headers.host ?? headers.Host).toBe(url.host);
      expect(headers["x-amz-date"] ?? headers["X-Amz-Date"]).toMatch(/^\d{8}T\d{6}Z$/);
      expect(auth).toMatch(/^AWS4-HMAC-SHA256 /);
      expect(auth).toContain("/ap-northeast-1/execute-api/aws4_request");
    });

    it("wraps credential failures with SSO guidance (L4)", async () => {
      // No env keys, no shared files → provider chain fails.
      const url = new URL("https://example.execute-api.ap-northeast-1.amazonaws.com/prod/auth/platform-token");
      await expect(
        defaultSignRequest({ url, region: "ap-northeast-1", awsProfile: "missing-profile-xyz" }),
      ).rejects.toThrow(/aws sso login/);
    });
  });

  describe("requestPlatformToken", () => {
    it("saves success body from signed POST", async () => {
      const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
        expect(init?.redirect).toBe("error");
        return new Response(
          JSON.stringify({
            accessToken: "plat-token",
            expiresIn: 900,
            tokenType: "Bearer",
            user: { id: "arn:aws:iam::1:user/x", role: "platform_admin", tenantId: null },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      });

      const result = await requestPlatformToken({
        baseUrl: "https://example.execute-api.ap-northeast-1.amazonaws.com/prod/",
        region: "ap-northeast-1",
        fetchImpl: fetchImpl as unknown as typeof fetch,
        signRequest: async () => ({
          authorization: "AWS4-HMAC-SHA256 Credential=AKIA/x, Signature=abc",
          host: "example.execute-api.ap-northeast-1.amazonaws.com",
          "content-type": "application/json",
        }),
      });

      expect(result.data?.accessToken).toBe("plat-token");
      expect(result.data?.expiresIn).toBe(900);
      expect(fetchImpl).toHaveBeenCalled();
    });

    it("maps 403 to Japanese IAM allowlist message with caveat (M2)", async () => {
      const fetchImpl = async () => new Response("Forbidden", { status: 403 });

      await expect(
        requestPlatformToken({
          baseUrl: "https://example.execute-api.ap-northeast-1.amazonaws.com/prod/",
          region: "ap-northeast-1",
          fetchImpl: fetchImpl as typeof fetch,
          signRequest: async () => ({
            authorization: "AWS4-HMAC-SHA256 Credential=AKIA/x, Signature=abc",
            "content-type": "application/json",
          }),
        }),
      ).rejects.toMatchObject({
        message: PLATFORM_TOKEN_FORBIDDEN_MESSAGE,
        status: 403,
      } satisfies Partial<PlatformLoginError>);
      expect(PLATFORM_TOKEN_FORBIDDEN_MESSAGE).toContain("許可された IAM 呼び出し元ではない");
    });

    it("surfaces 401 and 500 without the IAM allowlist message (L7)", async () => {
      for (const status of [401, 500] as const) {
        await expect(
          requestPlatformToken({
            baseUrl: "https://example.execute-api.ap-northeast-1.amazonaws.com/prod/",
            region: "ap-northeast-1",
            fetchImpl: (async () =>
              new Response(`boom-${status}`, { status })) as typeof fetch,
            signRequest: async () => ({
              authorization: "AWS4-HMAC-SHA256 Credential=AKIA/x, Signature=abc",
              "content-type": "application/json",
            }),
          }),
        ).rejects.toMatchObject({
          message: `boom-${status}`,
          status,
        });
      }
    });

    it("sanitizes control characters from non-403 error bodies", async () => {
      let caught: unknown;
      try {
        await requestPlatformToken({
          baseUrl: "https://example.execute-api.ap-northeast-1.amazonaws.com/prod/",
          region: "ap-northeast-1",
          fetchImpl: (async () =>
            new Response("oops\u001b[31mRED\u001b[0m", { status: 500 })) as typeof fetch,
          signRequest: async () => ({
            authorization: "AWS4-HMAC-SHA256 Credential=AKIA/x, Signature=abc",
            "content-type": "application/json",
          }),
        });
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(PlatformLoginError);
      const err = caught as PlatformLoginError;
      expect(err.status).toBe(500);
      expect(err.message.includes("\u001b")).toBe(false);
      expect(err.message).toContain("oops");
      expect(err.message).toContain("RED");
    });

    it("rejects invalid success JSON (L1)", async () => {
      await expect(
        requestPlatformToken({
          baseUrl: "https://example.execute-api.ap-northeast-1.amazonaws.com/prod/",
          region: "ap-northeast-1",
          fetchImpl: (async () =>
            new Response(JSON.stringify({ accessToken: "x", tokenType: "Bearer" }), {
              status: 200,
            })) as typeof fetch,
          signRequest: async () => ({
            authorization: "AWS4-HMAC-SHA256 Credential=AKIA/x, Signature=abc",
            "content-type": "application/json",
          }),
        }),
      ).rejects.toThrow(/user object/);
    });

    it("dry-run returns curl with masked AWS4-HMAC-SHA256 Authorization", async () => {
      const result = await requestPlatformToken({
        baseUrl: "https://example.execute-api.ap-northeast-1.amazonaws.com/prod/",
        region: "ap-northeast-1",
        dryRun: true,
        signRequest: async () => ({
          authorization:
            "AWS4-HMAC-SHA256 Credential=AKIAEXAMPLE/20260101/ap-northeast-1/execute-api/aws4_request, Signature=deadbeefcafe",
          host: "example.execute-api.ap-northeast-1.amazonaws.com",
          "content-type": "application/json",
          "x-amz-date": "20260101T000000Z",
        }),
      });

      expect(result.dryRunCurl).toBeDefined();
      expect(result.dryRunCurl).toContain("AWS4-HMAC-SHA256 <redacted>");
      expect(result.dryRunCurl).not.toContain("deadbeefcafe");
      expect(result.dryRunCurl).not.toContain("AKIAEXAMPLE");
      expect(result.dryRunCurl).toContain("/auth/platform-token");
      expect(result.data).toBeUndefined();
    });
  });
});
