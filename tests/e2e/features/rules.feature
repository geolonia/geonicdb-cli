@extended-api
Feature: Rule management
  As a CLI user
  I want to manage rules
  So that I can automate entity processing

  Scenario: List rules when none exist
    Given I am logged in
    When I run `geonic rules list`
    Then the exit code should be 0

  Scenario: Create a rule
    Given I am logged in
    When I run `geonic rules create '{"name":"test-rule-01","description":"Rule test-rule-01","conditions":[{"type":"celExpression","expression":"entity.temperature > 30"}],"actions":[{"type":"webhook","url":"http://localhost:5000/rules","method":"POST"}]}'`
    Then the exit code should be 0
    And the output should contain "Rule created."

  Scenario: List rules after creation
    Given I am logged in
    And I run `geonic rules create '{"name":"test-rule-02","description":"Rule test-rule-02","conditions":[{"type":"celExpression","expression":"entity.temperature > 30"}],"actions":[{"type":"webhook","url":"http://localhost:5000/rules","method":"POST"}]}'`
    When I run `geonic rules list`
    Then the exit code should be 0
    And the output should contain "test-rule-02"

  Scenario: Get a rule by ID
    Given I am logged in
    And I run `geonic rules create '{"name":"test-rule-03","description":"Rule test-rule-03","conditions":[{"type":"celExpression","expression":"entity.temperature > 30"}],"actions":[{"type":"webhook","url":"http://localhost:5000/rules","method":"POST"}]}'`
    And I run `geonic rules list --format json`
    And I save the ID from the JSON output
    When I run `geonic rules get $ID` replacing ID
    Then the exit code should be 0
    And stdout should be valid JSON

  Scenario: Delete a rule
    Given I am logged in
    And I run `geonic rules create '{"name":"test-rule-04","description":"Rule test-rule-04","conditions":[{"type":"celExpression","expression":"entity.temperature > 30"}],"actions":[{"type":"webhook","url":"http://localhost:5000/rules","method":"POST"}]}'`
    And I run `geonic rules list --format json`
    And I save the ID from the JSON output
    When I run `geonic rules delete $ID` replacing ID
    Then the exit code should be 0
    And the output should contain "Rule deleted."

  Scenario: Activate and deactivate a rule
    Given I am logged in
    And I run `geonic rules create '{"name":"test-rule-05","description":"Rule test-rule-05","conditions":[{"type":"celExpression","expression":"entity.temperature > 30"}],"actions":[{"type":"webhook","url":"http://localhost:5000/rules","method":"POST"}]}'`
    And I run `geonic rules list --format json`
    And I save the ID from the JSON output
    When I run `geonic rules deactivate $ID` replacing ID
    Then the exit code should be 0
    And the output should contain "Rule deactivated."
    When I run `geonic rules activate $ID` replacing ID
    Then the exit code should be 0
    And the output should contain "Rule activated."
