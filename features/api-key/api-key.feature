Feature: API key authentication
  As a CLI user
  I want to authenticate with API keys
  So that I can use service accounts and automation

  Background:
    Given a mock v2 entities endpoint

  Scenario: Authenticate with --api-key flag
    When I run "entities list --api-key test-api-key" with URL
    Then the exit code should be 0
    And the server should have received header "x-api-key" with value "test-api-key"

  Scenario: Authenticate with GDB_API_KEY environment variable
    Given the CLI is configured with URL to mock server
    When I run "entities list" with env "GDB_API_KEY=env-api-key"
    Then the exit code should be 0
    And the server should have received header "x-api-key" with value "env-api-key"

  Scenario: API key from config fallback
    Given the CLI is configured with:
      """
      { "apiKey": "config-api-key" }
      """
    And the CLI is configured with URL to mock server
    When I run "entities list"
    Then the exit code should be 0
    And the server should have received header "x-api-key" with value "config-api-key"

  Scenario: Token takes priority over API key
    Given the CLI is configured with:
      """
      { "token": "my-token", "apiKey": "my-api-key" }
      """
    And the CLI is configured with URL to mock server
    When I run "entities list"
    Then the exit code should be 0
    And the server should have received header "authorization" with value "Bearer my-token"
    And the server should not have received header "x-api-key"
