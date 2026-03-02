@extended-api
Feature: Admin policy management
  As an admin CLI user
  I want to manage policies
  So that I can control access permissions

  Scenario: List policies
    Given I am logged in
    When I run "geonic admin policies list"
    Then the exit code should be 0
    And stdout should be valid JSON

  Scenario: Create a policy
    Given I am logged in
    When I run "geonic admin policies create '{\"description\":\"Policy test-policy-01\",\"rules\":[{\"ruleId\":\"test-policy-01\",\"effect\":\"Permit\"}]}'"
    Then the exit code should be 0
    And the output should contain "Policy created."

  Scenario: Get a policy by ID
    Given I am logged in
    And I run "geonic admin policies create '{\"description\":\"Policy test-policy-02\",\"rules\":[{\"ruleId\":\"test-policy-02\",\"effect\":\"Permit\"}]}'"
    And I run "geonic admin policies list --format json"
    And I save the ID from the JSON output
    When I run "geonic admin policies get $ID" replacing ID
    Then the exit code should be 0
    And stdout should be valid JSON

  Scenario: Update a policy
    Given I am logged in
    And I run "geonic admin policies create '{\"description\":\"Policy test-policy-05\",\"rules\":[{\"ruleId\":\"test-policy-05\",\"effect\":\"Permit\"}]}'"
    And I run "geonic admin policies list --format json"
    And I save the ID from the JSON output
    When I run "geonic admin policies update $ID '{\"description\":\"Updated policy\"}'" replacing ID
    Then the exit code should be 0
    When I run "geonic admin policies get $ID" replacing ID
    Then the exit code should be 0
    And the output should contain "Updated policy"

  Scenario: Delete a policy
    Given I am logged in
    And I run "geonic admin policies create '{\"description\":\"Policy test-policy-03\",\"rules\":[{\"ruleId\":\"test-policy-03\",\"effect\":\"Permit\"}]}'"
    And I run "geonic admin policies list --format json"
    And I save the ID from the JSON output
    When I run "geonic admin policies delete $ID" replacing ID
    Then the exit code should be 0
    And the output should contain "Policy deleted."

  Scenario: Activate and deactivate a policy
    Given I am logged in
    And I run "geonic admin policies create '{\"description\":\"Policy test-policy-04\",\"rules\":[{\"ruleId\":\"test-policy-04\",\"effect\":\"Permit\"}]}'"
    And I run "geonic admin policies list --format json"
    And I save the ID from the JSON output
    When I run "geonic admin policies deactivate $ID" replacing ID
    Then the exit code should be 0
    And the output should contain "Policy deactivated."
    When I run "geonic admin policies activate $ID" replacing ID
    Then the exit code should be 0
    And the output should contain "Policy activated."
