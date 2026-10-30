import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  maskSigV4Headers,
  regionFromAwsConfig,
  resolveAwsRegion,
  requestPlatformToken,
  PlatformLoginError,
} from "../src/platform-login.js";

describe("platform-login helpers", () => {
  const prevRegion = process.env.AWS_REGION;
  const prevDefaultRegion = process.env.AWS_DEFAULT_REGION;
  const prevProfile = process.env.AWS_PROFILE;
  const prevConfigFile = process.env.AWS_CONFIG_FILE;
  let tmpDir: string | undefined;

  beforeEach(() => {
    delete process.env.AWS_REGION;
    delete process.env.AWS_DEFAULT_REGION;
    delete process.env.AWS_PROFILE;
    delete process.env.AWS_CONFIG_FILE;
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

  describe("requestPlatformToken", () => {
    it("saves success body from signed POST", async () => {
      const fetchImpl = async () =>
        new Response(
          JSON.stringify({
            accessToken: "plat-token",
            expiresIn: 900,
            tokenType: "Bearer",
            user: { id: "arn:aws:iam::1:user/x", role: "platform_admin", tenantId: null },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );

      const result = await requestPlatformToken({
        baseUrl: "https://example.execute-api.ap-northeast-1.amazonaws.com/prod/",
        region: "ap-northeast-1",
        fetchImpl: fetchImpl as typeof fetch,
        signRequest: async () => ({
          authorization: "AWS4-HMAC-SHA256 Credential=AKIA/x, Signature=abc",
          host: "example.execute-api.ap-northeast-1.amazonaws.com",
          "content-type": "application/json",
        }),
      });

      expect(result.data?.accessToken).toBe("plat-token");
      expect(result.data?.expiresIn).toBe(900);
    });

    it("maps 403 to Japanese IAM allowlist message", async () => {
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
        message: "許可された IAM 呼び出し元ではない",
        status: 403,
      } satisfies Partial<PlatformLoginError>);
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
