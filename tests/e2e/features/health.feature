Feature: Health and version
  As a CLI user
  I want to check server health and version
  So that I can verify connectivity and compatibility

  Scenario: Health check returns valid JSON
    Given I am logged in
    When I run `geonic health`
    Then the exit code should be 0
    And stdout should be valid JSON

  Scenario: Health check without URL configured
    Given no config file exists
    When I run `geonic health`
    Then the exit code should be 1
    And the output should contain "No URL configured"

  Scenario: Version displays CLI version
    Given I am logged in
    When I run `geonic version`
    Then the exit code should be 0
    And the output should contain "CLI version:"
