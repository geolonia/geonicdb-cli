@extended-api
Feature: Admin tenant management
  As an admin CLI user
  I want to manage tenants
  So that I can organize multi-tenant environments

  Scenario: List tenants
    Given I am logged in as super admin
    When I run `geonic admin tenants list`
    Then the exit code should be 0
    And stdout should be valid JSON

  Scenario: Create a tenant
    Given I am logged in as super admin
    When I run `geonic admin tenants create '{"name":"test_tenant_01","description":"Tenant test_tenant_01"}'`
    Then the exit code should be 0
    And the output should contain "Tenant created."

  Scenario: Get a tenant by ID
    Given I am logged in as super admin
    And I run `geonic admin tenants create '{"name":"test_tenant_02","description":"Tenant test_tenant_02"}'`
    And I run `geonic admin tenants list --format json`
    And I save the ID from the JSON output
    When I run `geonic admin tenants get $ID` replacing ID
    Then the exit code should be 0
    And stdout should be valid JSON

  Scenario: Update a tenant
    Given I am logged in as super admin
    And I run `geonic admin tenants create '{"name":"test_tenant_03","description":"Tenant test_tenant_03"}'`
    And I run `geonic admin tenants list --format json`
    And I save the ID from the JSON output
    When I run `geonic admin tenants update $ID '{"description":"Updated tenant"}'` replacing ID
    Then the exit code should be 0
    And the output should contain "Tenant updated."

  Scenario: Delete a tenant
    Given I am logged in as super admin
    And I run `geonic admin tenants create '{"name":"test_tenant_04","description":"Tenant test_tenant_04"}'`
    And I run `geonic admin tenants list --format json`
    And I save the ID from the JSON output
    When I run `geonic admin tenants delete $ID` replacing ID
    Then the exit code should be 0
    And the output should contain "Tenant deleted."

  Scenario: Activate and deactivate a tenant
    Given I am logged in as super admin
    And I run `geonic admin tenants create '{"name":"test_tenant_05","description":"Tenant test_tenant_05"}'`
    And I run `geonic admin tenants list --format json`
    And I save the ID from the JSON output
    When I run `geonic admin tenants deactivate $ID` replacing ID
    Then the exit code should be 0
    And the output should contain "Tenant deactivated."
    When I run `geonic admin tenants activate $ID` replacing ID
    Then the exit code should be 0
    And the output should contain "Tenant activated."
