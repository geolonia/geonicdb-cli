Feature: API key authentication
  As a CLI user
  I want to authenticate with API keys
  So that I can use service accounts and automation

  Scenario: --api-key flag sends X-Api-Key header in dry-run
    Given I have a config with url
    When I run `geonic entities list --api-key gdb_testkey123 --dry-run`
    Then the exit code should be 0
    And stdout should contain "X-Api-Key"
    And stdout should not contain "Authorization"

  Scenario: GDB_API_KEY env var sends X-Api-Key header in dry-run
    Given I have a config with url
    When I run entities list with api-key env var in dry-run
    Then the exit code should be 0
    And stdout should contain "X-Api-Key"
    And stdout should not contain "Authorization"

  Scenario: apiKey from config sends X-Api-Key header in dry-run
    Given I have a config with url and apiKey
    When I run `geonic entities list --dry-run`
    Then the exit code should be 0
    And stdout should contain "X-Api-Key"
    And stdout should not contain "Authorization"

  Scenario: Token takes priority over API key
    Given I am logged in with token and invalid apiKey in config
    When I run `geonic entities list --dry-run`
    Then the exit code should be 0
    And stdout should contain "Authorization"
    And stdout should not contain "X-Api-Key"

  Scenario: CLI --api-key overrides saved login token in dry-run
    Given I am logged in with token and invalid apiKey in config
    When I run `geonic entities list --api-key gdb_cli_override --dry-run`
    Then the exit code should be 0
    And stdout should contain "X-Api-Key"
    And stdout should contain "gdb_cli_override"
    And stdout should not contain "Authorization"

  Scenario: --token and --api-key together are rejected
    Given I have a config with url
    When I run `geonic entities list --token saved-token --api-key gdb_cli_key --dry-run`
    Then the exit code should be 1
    And stderr should contain "Cannot use --token and --api-key together"
