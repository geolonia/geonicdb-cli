@platform-login
Feature: Platform admin IAM login
  As a platform operator
  I want to exchange AWS IAM credentials for a platform_admin token
  So that I can call platform management APIs

  # Local GeonicDB has no API Gateway IAM authorizer → missing userArn → 403.
  Scenario: platform-login against local server returns IAM allowlist 403
    Given the CLI is configured with server URL
    And I have static AWS credentials for SigV4 signing
    When I run `geonic auth platform-login --aws-region ap-northeast-1`
    Then the exit code should be 1
    And the output should contain "許可された IAM 呼び出し元ではない"
    And the output should contain "署名・region・資格情報の不正でも 403 になりうる"

  Scenario: platform-login --dry-run prints masked AWS4-HMAC-SHA256 Authorization
    Given the CLI is configured with server URL
    And I have static AWS credentials for SigV4 signing
    When I run `geonic auth platform-login --aws-region ap-northeast-1 --dry-run`
    Then the exit code should be 0
    And the output should contain "AWS4-HMAC-SHA256 <redacted>"
    And the output should contain "/auth/platform-token"
    And the output should not contain "Signature="
