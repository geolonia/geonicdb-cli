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
    When I create an admin policy "test-policy-01"
    Then the exit code should be 0
    And the output should contain "Policy created."

  Scenario: Get a policy by ID
    Given I am logged in
    And I create an admin policy "test-policy-02"
    And I get the admin policy ID
    When I run admin policies get with the saved ID
    Then the exit code should be 0
    And stdout should be valid JSON

  Scenario: Delete a policy
    Given I am logged in
    And I create an admin policy "test-policy-03"
    And I get the admin policy ID
    When I delete the admin policy
    Then the exit code should be 0
    And the output should contain "Policy deleted."

  Scenario: Activate and deactivate a policy
    Given I am logged in
    And I create an admin policy "test-policy-04"
    And I get the admin policy ID
    When I deactivate the admin policy
    Then the exit code should be 0
    And the output should contain "Policy deactivated."
    When I activate the admin policy
    Then the exit code should be 0
    And the output should contain "Policy activated."
