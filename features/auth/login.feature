Feature: Login authentication
  As a CLI user
  I want to authenticate with the GeonicDB server
  So that I can access protected resources

  Scenario: Successful login with email and password
    Given a mock auth server that accepts login
    When I run login with credentials
    Then the exit code should be 0
    And the output should contain "Login successful"
    And a token should be saved in config
    And the token should be "mock-token-abc123"

  Scenario: Login saves refresh token
    Given a mock auth server that accepts login
    When I run login with credentials
    Then the exit code should be 0
    And a refresh token should be saved in config

  Scenario: Login with --url flag
    Given a mock auth server that accepts login
    When I run login with credentials and URL
    Then the exit code should be 0
    And the output should contain "Login successful"
    And a token should be saved in config

  Scenario: Login sends correct credentials to server
    Given a mock auth server that accepts login
    When I run login with credentials
    Then the auth server should have received a POST to "/auth/login"
    And the auth request body should contain email "user@example.com"

  Scenario: Login without credentials shows error
    Given the CLI is configured with URL "http://localhost:9999"
    When I run login without credentials
    Then the exit code should be 1
    And the output should contain "GDB_EMAIL"
    And the output should contain "GDB_PASSWORD"

  Scenario: Login with invalid credentials
    Given a mock auth server that rejects login
    When I run login with credentials
    Then the exit code should be 1
    And the output should contain "Authentication failed"

  Scenario: Login with server error
    Given a mock auth server with server error
    When I run login with credentials
    Then the exit code should be 1
    And the output should contain "Server error"
