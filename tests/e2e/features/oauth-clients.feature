@extended-api
Feature: Admin OAuth client management
  As an admin CLI user
  I want to manage OAuth clients
  So that I can control application access

  Scenario: List OAuth clients
    Given I am logged in
    When I run `geonic admin oauth-clients list`
    Then the exit code should be 0
    And stdout should be valid JSON

  Scenario: Create an OAuth client
    Given I am logged in
    When I run `geonic admin oauth-clients create '{"name":"test-client-01"}'`
    Then the exit code should be 0
    And the output should contain "OAuth client created."

  Scenario: Get an OAuth client by ID
    Given I am logged in
    And I run `geonic admin oauth-clients create '{"name":"test-client-02"}'`
    And I run `geonic admin oauth-clients list --format json`
    And I save the ID from the JSON output
    When I run `geonic admin oauth-clients get $ID` replacing ID
    Then the exit code should be 0
    And stdout should be valid JSON

  Scenario: Update an OAuth client
    Given I am logged in
    And I run `geonic admin oauth-clients create '{"name":"test-client-04"}'`
    And I run `geonic admin oauth-clients list --format json`
    And I save the ID from the JSON output
    When I run `geonic admin oauth-clients update $ID '{"description":"Updated client"}'` replacing ID
    Then the exit code should be 0
    When I run `geonic admin oauth-clients get $ID` replacing ID
    Then the exit code should be 0
    And the output should contain "Updated client"

  Scenario: Delete an OAuth client
    Given I am logged in
    And I run `geonic admin oauth-clients create '{"name":"test-client-03"}'`
    And I run `geonic admin oauth-clients list --format json`
    And I save the ID from the JSON output
    When I run `geonic admin oauth-clients delete $ID` replacing ID
    Then the exit code should be 0
    And the output should contain "OAuth client deleted."
