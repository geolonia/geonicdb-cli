Feature: Config migration
  As a CLI user
  I want my old config format to be automatically migrated
  So that I can upgrade without manual changes

  Scenario: Migrate v1 config to v2 format
    Given the CLI is configured with:
      """
      { "url": "http://localhost:3000", "token": "old-token" }
      """
    When I run "geonic config list"
    Then the exit code should be 0
    And stdout should contain "url"
