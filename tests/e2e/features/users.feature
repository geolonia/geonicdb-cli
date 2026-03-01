@extended-api
Feature: Admin user management
  As an admin CLI user
  I want to manage users
  So that I can control access to the system

  Scenario: List users
    Given I am logged in
    When I run "geonic admin users list"
    Then the exit code should be 0
    And stdout should be valid JSON

  Scenario: Create a user
    Given I am logged in
    When I create an admin user "testuser01@example.com"
    Then the exit code should be 0
    And the output should contain "User created."

  Scenario: Get a user by ID
    Given I am logged in
    And I create an admin user "testuser02@example.com"
    And I get the admin user ID
    When I run admin users get with the saved ID
    Then the exit code should be 0
    And stdout should be valid JSON
    And the output should contain "testuser02@example.com"

  Scenario: Delete a user
    Given I am logged in
    And I create an admin user "testuser03@example.com"
    And I get the admin user ID
    When I delete the admin user
    Then the exit code should be 0
    And the output should contain "User deleted."

  Scenario: Activate and deactivate a user
    Given I am logged in
    And I create an admin user "testuser04@example.com"
    And I get the admin user ID
    When I deactivate the admin user
    Then the exit code should be 0
    And the output should contain "User deactivated."
    When I activate the admin user
    Then the exit code should be 0
    And the output should contain "User activated."

  Scenario: Unlock a user
    Given I am logged in
    And I create an admin user "testuser05@example.com"
    And I get the admin user ID
    When I unlock the admin user
    Then the exit code should be 0
    And the output should contain "User unlocked."
