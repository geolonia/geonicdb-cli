Feature: Authentication
  As a CLI user
  I want to manage authentication
  So that I can access protected resources

  # geonic auth login

  Scenario: Login without interactive terminal shows error
    Given the CLI is configured with URL "http://localhost:3000"
    When I run login without credentials
    Then the exit code should be 1
    And the output should contain "Interactive terminal required"

  # geonic auth logout

  Scenario: Logout clears token from config
    Given I am logged in
    When I run `geonic logout`
    Then the exit code should be 0
    And the output should contain "Logged out"
    And no token should be in config

  Scenario: Logout clears refresh token from config
    Given I am logged in
    When I run `geonic logout`
    Then the exit code should be 0
    And no refresh token should be in config

  Scenario: Logout when not logged in still succeeds
    Given I am not logged in
    When I run `geonic logout`
    Then the exit code should be 0
    And the output should contain "Logged out"

  # geonic whoami

  Scenario: Display user info when logged in
    Given I am logged in
    When I run `geonic whoami`
    Then the exit code should be 0
    And stdout should contain "tenant-admin@test.com"

  Scenario: Show message when not logged in
    Given I am not logged in
    When I run `geonic whoami`
    Then the exit code should be 0
    And the output should contain "Not logged in"

  Scenario: Whoami with JSON format
    Given I am logged in
    When I run `geonic whoami --format json`
    Then the exit code should be 0
    And stdout should be valid JSON
    And the JSON output should have key "email"
    And the JSON output key "email" should be "tenant-admin@test.com"

  Scenario: Whoami with expired token
    Given I have invalid authentication tokens
    When I run `geonic whoami`
    Then the exit code should be 1
    And the output should contain "Authentication failed"

  # Token refresh

  Scenario: Automatic token refresh on 401
    Given I am logged in with an invalidated token
    When I run `geonic entities list`
    Then the exit code should be 0

  Scenario: Failed token refresh propagates error
    Given I have invalid authentication tokens
    When I run `geonic entities list`
    Then the exit code should be 1
    And the output should contain "Authentication failed"
