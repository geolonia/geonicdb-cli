@extended-api
Feature: Admin tenant management
  As an admin CLI user
  I want to manage tenants
  So that I can organize multi-tenant environments

  Scenario: List tenants
    Given I am logged in
    When I run "geonic admin tenants list"
    Then the exit code should be 0
    And stdout should be valid JSON

  Scenario: Create a tenant
    Given I am logged in
    When I create an admin tenant "test-tenant-01"
    Then the exit code should be 0
    And the output should contain "Tenant created."

  Scenario: Get a tenant by ID
    Given I am logged in
    And I create an admin tenant "test-tenant-02"
    And I get the admin tenant ID
    When I run admin tenants get with the saved ID
    Then the exit code should be 0
    And stdout should be valid JSON

  Scenario: Update a tenant
    Given I am logged in
    And I create an admin tenant "test-tenant-03"
    And I get the admin tenant ID
    When I update the admin tenant with '{"description":"Updated tenant"}'
    Then the exit code should be 0
    And the output should contain "Tenant updated."

  Scenario: Delete a tenant
    Given I am logged in
    And I create an admin tenant "test-tenant-04"
    And I get the admin tenant ID
    When I delete the admin tenant
    Then the exit code should be 0
    And the output should contain "Tenant deleted."

  Scenario: Activate and deactivate a tenant
    Given I am logged in
    And I create an admin tenant "test-tenant-05"
    And I get the admin tenant ID
    When I deactivate the admin tenant
    Then the exit code should be 0
    And the output should contain "Tenant deactivated."
    When I activate the admin tenant
    Then the exit code should be 0
    And the output should contain "Tenant activated."
