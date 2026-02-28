Feature: Token refresh
  As a CLI user
  I want my token to be refreshed automatically
  So that I don't have to re-login when my token expires

  Scenario: Automatic token refresh on 401
    Given I am logged in with an invalidated token
    When I run "geonic entities list"
    Then the exit code should be 0

  Scenario: Failed token refresh propagates error
    Given I have invalid authentication tokens
    When I run "geonic entities list"
    Then the exit code should be 1
    And the output should contain "Authentication failed"
