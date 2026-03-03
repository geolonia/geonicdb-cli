@extended-api
Feature: Admin user management
  As an admin CLI user
  I want to manage users
  So that I can control access to the system

  Scenario: List users
    Given I am logged in
    When I run `geonic admin users list`
    Then the exit code should be 0
    And stdout should be valid JSON

  Scenario: Create a user
    Given I am logged in
    When I run `geonic admin users create '{"email":"testuser01@example.com","password":"TestPassword123!","role":"super_admin"}'`
    Then the exit code should be 0
    And the output should contain "User created."

  Scenario: Get a user by ID
    Given I am logged in
    And I run `geonic admin users create '{"email":"testuser02@example.com","password":"TestPassword123!","role":"super_admin"}'`
    And I run `geonic admin users list --format json`
    And I save the ID from the JSON output where "email" is "testuser02@example.com"
    When I run `geonic admin users get $ID` replacing ID
    Then the exit code should be 0
    And stdout should be valid JSON
    And the output should contain "testuser02@example.com"

  Scenario: Delete a user
    Given I am logged in
    And I run `geonic admin users create '{"email":"testuser03@example.com","password":"TestPassword123!","role":"super_admin"}'`
    And I run `geonic admin users list --format json`
    And I save the ID from the JSON output where "email" is "testuser03@example.com"
    When I run `geonic admin users delete $ID` replacing ID
    Then the exit code should be 0
    And the output should contain "User deleted."

  Scenario: Activate and deactivate a user
    Given I am logged in
    And I run `geonic admin users create '{"email":"testuser04@example.com","password":"TestPassword123!","role":"super_admin"}'`
    And I run `geonic admin users list --format json`
    And I save the ID from the JSON output where "email" is "testuser04@example.com"
    When I run `geonic admin users deactivate $ID` replacing ID
    Then the exit code should be 0
    And the output should contain "User deactivated."
    When I run `geonic admin users activate $ID` replacing ID
    Then the exit code should be 0
    And the output should contain "User activated."

  Scenario: Unlock a user
    Given I am logged in
    And I run `geonic admin users create '{"email":"testuser05@example.com","password":"TestPassword123!","role":"super_admin"}'`
    And I run `geonic admin users list --format json`
    And I save the ID from the JSON output where "email" is "testuser05@example.com"
    When I run `geonic admin users unlock $ID` replacing ID
    Then the exit code should be 0
    And the output should contain "User unlocked."
