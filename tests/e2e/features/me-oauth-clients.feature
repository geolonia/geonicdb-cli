@extended-api
Feature: User self-service OAuth client management
  As a logged-in user
  I want to manage my own OAuth clients
  So that I can create credentials for CI/CD and scripts without admin help

  Scenario: List my OAuth clients (initially empty)
    Given I am logged in
    When I run `geonic me oauth-clients list`
    Then the exit code should be 0
    And stdout should be valid JSON
    And the JSON array length should be 0

  Scenario: Create an OAuth client
    Given I am logged in
    When I run `geonic me oauth-clients create '{"name":"my-ci-bot"}'`
    Then the exit code should be 0
    And the output should contain "OAuth client created."
    And stdout should be valid JSON
    And the JSON output should have key "clientId"
    And the JSON output should have key "clientSecret"

  Scenario: Create an OAuth client with --name flag
    Given I am logged in
    When I run `geonic me oauth-clients create --name my-flag-bot`
    Then the exit code should be 0
    And the output should contain "OAuth client created."
    And stdout should be valid JSON
    And the JSON output should have key "clientId"

  Scenario: Create with --save stores credentials in config
    Given I am logged in
    When I run `geonic me oauth-clients create --name my-saved-bot --save`
    Then the exit code should be 0
    And the output should contain "OAuth client created."
    And the output should contain "Auto-reauth enabled"
    And the config should have key "clientId"
    And the config should have key "clientSecret"
    And the config should have key "token"

  Scenario: Created client appears in list
    Given I am logged in
    And I run `geonic me oauth-clients create '{"name":"list-test-bot"}'`
    When I run `geonic me oauth-clients list --format json`
    Then the exit code should be 0
    And the output should contain "list-test-bot"

  Scenario: Delete an OAuth client
    Given I am logged in
    And I run `geonic me oauth-clients create '{"name":"delete-me-bot"}'`
    And I run `geonic me oauth-clients list --format json`
    And I save the ID from the JSON output
    When I run `geonic me oauth-clients delete $ID` replacing ID
    Then the exit code should be 0
    And the output should contain "OAuth client deleted."

  Scenario: Auto-reauth with saved client credentials
    Given I am logged in
    And I run `geonic me oauth-clients create --name auto-reauth-bot --save`
    And I invalidate the current token keeping client credentials
    When I run `geonic me oauth-clients list`
    Then the exit code should be 0
