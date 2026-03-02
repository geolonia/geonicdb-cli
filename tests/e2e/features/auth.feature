Feature: Authentication
  As a CLI user
  I want to manage authentication
  So that I can access protected resources

  # geonic auth login

  Scenario: Successful login with email and password
    Given the CLI is configured with server URL
    When I run login with credentials
    Then the exit code should be 0
    And the output should contain "Login successful"
    And a token should be saved in config

  Scenario: Login saves refresh token
    Given the CLI is configured with server URL
    When I run login with credentials
    Then the exit code should be 0
    And a refresh token should be saved in config

  Scenario: Login with --url flag
    When I run login with credentials and URL
    Then the exit code should be 0
    And the output should contain "Login successful"
    And a token should be saved in config

  Scenario: Login without credentials shows error
    Given the CLI is configured with URL "http://localhost:3000"
    When I run login without credentials
    Then the exit code should be 1
    And the output should contain "GDB_EMAIL"
    And the output should contain "GDB_PASSWORD"

  Scenario: Login with invalid credentials
    Given the CLI is configured with server URL
    When I run login with invalid credentials
    Then the exit code should be 1
    And the output should contain "Authentication failed"

  Scenario: Login with unreachable server
    Given the CLI is configured with URL "http://localhost:59999"
    When I run login with credentials
    Then the exit code should be 1

  # geonic auth logout

  Scenario: Logout clears token from config
    Given I am logged in
    When I run "geonic logout"
    Then the exit code should be 0
    And the output should contain "Logged out"
    And no token should be in config

  Scenario: Logout clears refresh token from config
    Given I am logged in
    When I run "geonic logout"
    Then the exit code should be 0
    And no refresh token should be in config

  Scenario: Logout when not logged in still succeeds
    Given I am not logged in
    When I run "geonic logout"
    Then the exit code should be 0
    And the output should contain "Logged out"

  # geonic whoami

  Scenario: Display user info when logged in
    Given I am logged in
    When I run "geonic whoami"
    Then the exit code should be 0
    And stdout should contain "admin@test.com"

  Scenario: Show message when not logged in
    Given I am not logged in
    When I run "geonic whoami"
    Then the exit code should be 0
    And the output should contain "Not logged in"

  Scenario: Whoami with JSON format
    Given I am logged in
    When I run "geonic whoami --format json"
    Then the exit code should be 0
    And stdout should be valid JSON
    And the JSON output should have key "email"
    And the JSON output key "email" should be "admin@test.com"

  Scenario: Whoami with expired token
    Given I have invalid authentication tokens
    When I run "geonic whoami"
    Then the exit code should be 1
    And the output should contain "Authentication failed"

  # Token refresh

  Scenario: Automatic token refresh on 401
    Given I am logged in with an invalidated token
    When I run "geonic entities list"
    Then the exit code should be 0

  Scenario: Failed token refresh propagates error
    Given I have invalid authentication tokens
    When I run "geonic entities list"
    Then the exit code should be 1
    And the output should contain "Authentication failed"
