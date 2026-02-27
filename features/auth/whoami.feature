Feature: Whoami
  As a CLI user
  I want to see my current user info
  So that I know which account I'm using

  Scenario: Display user info when logged in
    Given a mock auth server that returns user info
    When I run "whoami"
    Then the exit code should be 0
    And stdout should contain "user@example.com"

  Scenario: Show message when not logged in
    Given I am not logged in
    When I run "whoami"
    Then the exit code should be 0
    And the output should contain "Not logged in"

  Scenario: Whoami with JSON format
    Given a mock auth server that returns user info
    When I run "whoami --format json"
    Then the exit code should be 0
    And stdout should be valid JSON
    And the JSON output should have key "email"
    And the JSON output key "email" should be "user@example.com"

  Scenario: Whoami with expired token
    Given a mock auth server that returns 401 for user info
    When I run "whoami"
    Then the exit code should be 1
    And the output should contain "Token expired"
