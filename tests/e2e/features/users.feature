@extended-api
Feature: Admin user management
  As an admin CLI user
  I want to manage users
  So that I can control access to the system

  Scenario: List users
    Given I am logged in as super admin
    When I run `geonic admin users list`
    Then the exit code should be 0
    And stdout should be valid JSON

  Scenario: Create a user
    Given I am logged in as super admin
    When I run `geonic admin users create '{"email":"testuser01@example.com","password":"TestPassword123!","role":"super_admin"}'`
    Then the exit code should be 0
    And the output should contain "User created."

  Scenario: Get a user by ID
    Given I am logged in as super admin
    And I run `geonic admin users create '{"email":"testuser02@example.com","password":"TestPassword123!","role":"super_admin"}'`
    And I run `geonic admin users list --format json`
    And I save the ID from the JSON output where "email" is "testuser02@example.com"
    When I run `geonic admin users get $ID` replacing ID
    Then the exit code should be 0
    And stdout should be valid JSON
    And the output should contain "testuser02@example.com"

  Scenario: Delete a user
    Given I am logged in as super admin
    And I run `geonic admin users create '{"email":"testuser03@example.com","password":"TestPassword123!","role":"super_admin"}'`
    And I run `geonic admin users list --format json`
    And I save the ID from the JSON output where "email" is "testuser03@example.com"
    When I run `geonic admin users delete $ID` replacing ID
    Then the exit code should be 0
    And the output should contain "User deleted."

  Scenario: Activate and deactivate a user
    Given I am logged in as super admin
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
    Given I am logged in as super admin
    And I run `geonic admin users create '{"email":"testuser05@example.com","password":"TestPassword123!","role":"super_admin"}'`
    And I run `geonic admin users list --format json`
    And I save the ID from the JSON output where "email" is "testuser05@example.com"
    When I run `geonic admin users unlock $ID` replacing ID
    Then the exit code should be 0
    And the output should contain "User unlocked."

  Scenario: Create a user with a forced password reset (invite, geonicdb#1532)
    Given I am logged in as super admin
    When I run `geonic admin users create --force-reset '{"email":"testuser06@example.com","role":"super_admin"}'`
    Then the exit code should be 0
    And the output should contain "User created (forced password reset)."
    And stdout should contain "temporaryPassword"

  Scenario: Reject --force-reset with a password field
    Given I am logged in as super admin
    When I run `geonic admin users create --force-reset '{"email":"testuser07@example.com","password":"TestPassword123!","role":"super_admin"}'`
    Then the exit code should be 1
    And the output should contain "do not include a 'password' field"

  Scenario: Reset a user's password
    Given I am logged in as super admin
    And I run `geonic admin users create '{"email":"testuser08@example.com","password":"TestPassword123!","role":"super_admin"}'`
    And I run `geonic admin users list --format json`
    And I save the ID from the JSON output where "email" is "testuser08@example.com"
    When I run `geonic admin users reset-password $ID` replacing ID
    Then the exit code should be 0
    And the output should contain "Temporary password issued."
    And stdout should contain "temporaryPassword"

  @issue-274
  Scenario: Resend and revoke a set-password invitation
    Given I am logged in as super admin
    When I run `geonic admin users invite urn:user:274 --dry-run`
    Then the exit code should be 0
    And stdout should contain "-X POST"
    And stdout should contain "/admin/users/urn%3Auser%3A274/invite"
    When I run `geonic admin users invite-revoke urn:user:274 --dry-run`
    Then the exit code should be 0
    And stdout should contain "-X DELETE"
    And stdout should contain "/admin/users/urn%3Auser%3A274/invite"
