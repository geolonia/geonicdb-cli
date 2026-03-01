@extended-api
Feature: Rule management
  As a CLI user
  I want to manage rules
  So that I can automate entity processing

  Scenario: List rules when none exist
    Given I am logged in
    When I run "geonic rules list"
    Then the exit code should be 0

  Scenario: Create a rule
    Given I am logged in
    When I create a rule "test-rule-01"
    Then the exit code should be 0
    And the output should contain "Rule created."

  Scenario: List rules after creation
    Given I am logged in
    And I create a rule "test-rule-02"
    When I run "geonic rules list"
    Then the exit code should be 0
    And the output should contain "test-rule-02"

  Scenario: Get a rule by ID
    Given I am logged in
    And I create a rule "test-rule-03"
    And I get the rule ID from the list
    When I get the rule by ID
    Then the exit code should be 0
    And stdout should be valid JSON

  Scenario: Delete a rule
    Given I am logged in
    And I create a rule "test-rule-04"
    And I get the rule ID from the list
    When I delete the rule
    Then the exit code should be 0
    And the output should contain "Rule deleted."

  Scenario: Activate and deactivate a rule
    Given I am logged in
    And I create a rule "test-rule-05"
    And I get the rule ID from the list
    When I deactivate the rule
    Then the exit code should be 0
    And the output should contain "Rule deactivated."
    When I activate the rule
    Then the exit code should be 0
    And the output should contain "Rule activated."
