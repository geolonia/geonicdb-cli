Feature: Login authentication
  As a CLI user
  I want to authenticate with the GeonicDB server
  So that I can access protected resources

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
