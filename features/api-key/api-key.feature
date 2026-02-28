Feature: API key authentication
  As a CLI user
  I want to authenticate with API keys
  So that I can use service accounts and automation

  Scenario: Authenticate with --api-key flag
    Given I have a valid API key from login
    When I run entities list with api-key flag
    Then the exit code should be 0

  Scenario: Authenticate with GDB_API_KEY environment variable
    Given I have a valid API key from login
    When I run entities list with api-key env var
    Then the exit code should be 0

  Scenario: API key from config fallback
    Given I have a valid API key saved in config as apiKey
    When I run "gdb entities list"
    Then the exit code should be 0

  Scenario: Token takes priority over API key
    Given I am logged in with token and invalid apiKey in config
    When I run "gdb entities list"
    Then the exit code should be 0
