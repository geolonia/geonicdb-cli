Feature: Token refresh
  As a CLI user
  I want my token to be refreshed automatically
  So that I don't have to re-login when my token expires

  Scenario: Automatic token refresh on 401
    Given a mock server that returns 401 then succeeds after token refresh
    When I run "entities list"
    Then the exit code should be 0
    And stdout should contain "entity1"

  Scenario: Failed token refresh propagates error
    Given a mock server that returns 401 and refresh also fails
    When I run "entities list"
    Then the exit code should be 1
    And the output should contain "Authentication failed"
