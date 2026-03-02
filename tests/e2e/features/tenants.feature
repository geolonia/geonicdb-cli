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
    When I run "geonic admin tenants create '{\"name\":\"test-tenant-01\",\"description\":\"Tenant test-tenant-01\"}'"
    Then the exit code should be 0
    And the output should contain "Tenant created."

  Scenario: Get a tenant by ID
    Given I am logged in
    And I run "geonic admin tenants create '{\"name\":\"test-tenant-02\",\"description\":\"Tenant test-tenant-02\"}'"
    And I run "geonic admin tenants list --format json"
    And I save the ID from the JSON output
    When I run "geonic admin tenants get $ID" replacing ID
    Then the exit code should be 0
    And stdout should be valid JSON

  Scenario: Update a tenant
    Given I am logged in
    And I run "geonic admin tenants create '{\"name\":\"test-tenant-03\",\"description\":\"Tenant test-tenant-03\"}'"
    And I run "geonic admin tenants list --format json"
    And I save the ID from the JSON output
    When I run "geonic admin tenants update $ID '{\"description\":\"Updated tenant\"}'" replacing ID
    Then the exit code should be 0
    And the output should contain "Tenant updated."

  Scenario: Delete a tenant
    Given I am logged in
    And I run "geonic admin tenants create '{\"name\":\"test-tenant-04\",\"description\":\"Tenant test-tenant-04\"}'"
    And I run "geonic admin tenants list --format json"
    And I save the ID from the JSON output
    When I run "geonic admin tenants delete $ID" replacing ID
    Then the exit code should be 0
    And the output should contain "Tenant deleted."

  Scenario: Activate and deactivate a tenant
    Given I am logged in
    And I run "geonic admin tenants create '{\"name\":\"test-tenant-05\",\"description\":\"Tenant test-tenant-05\"}'"
    And I run "geonic admin tenants list --format json"
    And I save the ID from the JSON output
    When I run "geonic admin tenants deactivate $ID" replacing ID
    Then the exit code should be 0
    And the output should contain "Tenant deactivated."
    When I run "geonic admin tenants activate $ID" replacing ID
    Then the exit code should be 0
    And the output should contain "Tenant activated."
