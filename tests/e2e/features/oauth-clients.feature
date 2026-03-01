@extended-api
Feature: Admin OAuth client management
  As an admin CLI user
  I want to manage OAuth clients
  So that I can control application access

  Scenario: List OAuth clients
    Given I am logged in
    When I run "geonic admin oauth-clients list"
    Then the exit code should be 0
    And stdout should be valid JSON

  Scenario: Create an OAuth client
    Given I am logged in
    When I create an admin oauth-client "test-client-01"
    Then the exit code should be 0
    And the output should contain "OAuth client created."

  Scenario: Get an OAuth client by ID
    Given I am logged in
    And I create an admin oauth-client "test-client-02"
    And I get the admin oauth-client ID
    When I run admin oauth-clients get with the saved ID
    Then the exit code should be 0
    And stdout should be valid JSON

  Scenario: Update an OAuth client
    Given I am logged in
    And I create an admin oauth-client "test-client-04"
    And I get the admin oauth-client ID
    When I update the admin oauth-client with '{"description":"Updated client"}'
    Then the exit code should be 0
    When I run admin oauth-clients get with the saved ID
    Then the exit code should be 0
    And the output should contain "Updated client"

  Scenario: Delete an OAuth client
    Given I am logged in
    And I create an admin oauth-client "test-client-03"
    And I get the admin oauth-client ID
    When I delete the admin oauth-client
    Then the exit code should be 0
    And the output should contain "OAuth client deleted."
