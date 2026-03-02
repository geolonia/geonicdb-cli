@extended-api @wip
Feature: Admin CADDE configuration
  # CADDE set endpoint requires fields not yet documented; skipping until clarified
  As an admin CLI user
  I want to manage CADDE configuration
  So that I can configure data exchange settings

  Scenario: Get CADDE configuration
    Given I am logged in
    When I run `geonic admin cadde get`
    Then the exit code should be 0

  Scenario: Set CADDE configuration
    Given I am logged in
    When I run `geonic admin cadde set '{"provider":"test","endpoint":"http://localhost:6000"}'`
    Then the exit code should be 0
    And the output should contain "CADDE configuration set."

  Scenario: Delete CADDE configuration
    Given I am logged in
    When I run `geonic admin cadde delete`
    Then the exit code should be 0
    And the output should contain "CADDE configuration deleted."
