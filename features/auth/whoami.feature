Feature: Whoami
  As a CLI user
  I want to see my current user info
  So that I know which account I'm using

  Scenario: Display user info when logged in
    Given I am logged in
    When I run "gdb whoami"
    Then the exit code should be 0
    And stdout should contain "admin@test.com"

  Scenario: Show message when not logged in
    Given I am not logged in
    When I run "gdb whoami"
    Then the exit code should be 0
    And the output should contain "Not logged in"

  Scenario: Whoami with JSON format
    Given I am logged in
    When I run "gdb whoami --format json"
    Then the exit code should be 0
    And stdout should be valid JSON
    And the JSON output should have key "email"
    And the JSON output key "email" should be "admin@test.com"

  Scenario: Whoami with expired token
    Given I have invalid authentication tokens
    When I run "gdb whoami"
    Then the exit code should be 1
    And the output should contain "Authentication failed"
