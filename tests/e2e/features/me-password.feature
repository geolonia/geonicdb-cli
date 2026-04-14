@extended-api
Feature: User password change
  As a logged-in user
  I want to change my password
  So that I can maintain account security

  # Error cases using shared tenant-admin — no actual password change occurs

  Scenario: Wrong current password returns error
    Given I am logged in
    When I run `geonic me password --current-password WrongPassword123! --new-password NewSecurePass456!`
    Then the exit code should be 1

  Scenario: Same password as current returns error
    Given I am logged in
    When I run `geonic me password --current-password TenantAdmin123! --new-password TenantAdmin123!`
    Then the exit code should be 1

  Scenario: Password too short returns error
    Given I am logged in
    When I run `geonic me password --current-password TenantAdmin123! --new-password short`
    Then the exit code should be 1

  Scenario: Without authentication returns error
    Given I am not logged in
    When I run `geonic me password --current-password TenantAdmin123! --new-password NewSecurePass456!`
    Then the exit code should be 1
    And the output should contain "Authentication failed"

  # Success case — uses a dedicated user so token invalidation doesn't
  # pollute the shared tenant-admin's server-side cache.

  Scenario: Change password, verify token invalidation, and login with new password
    Given I am logged in as password test user
    # Step 1: Change password
    When I run `geonic me password --current-password PwTestUser12345! --new-password ChangedPw98765!`
    Then the exit code should be 0
    And the output should contain "Password changed."
    And the output should contain "All existing tokens have been invalidated"
    # Step 2: Old token should be invalidated
    When I run `geonic me`
    Then the exit code should be 1
    And the output should contain "Authentication failed"
    # Step 3: Login with new password and verify access
    When I login with email "pw-test@test.com" and password "ChangedPw98765!"
    And I run `geonic me --format json`
    Then the exit code should be 0
    And the JSON output key "email" should be "pw-test@test.com"
