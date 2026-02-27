Feature: Logout
  As a CLI user
  I want to clear my authentication
  So that my tokens are removed

  Scenario: Logout clears token from config
    Given I am logged in
    When I run "logout"
    Then the exit code should be 0
    And the output should contain "Logged out"
    And no token should be in config

  Scenario: Logout clears refresh token from config
    Given I am logged in
    When I run "logout"
    Then the exit code should be 0
    And no refresh token should be in config

  Scenario: Logout when not logged in still succeeds
    Given I am not logged in
    When I run "logout"
    Then the exit code should be 0
    And the output should contain "Logged out"
