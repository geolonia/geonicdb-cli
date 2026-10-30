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

  Scenario: Add, list, and remove a tenant membership
    Given I am logged in as super admin
    And I run `geonic admin tenants create '{"name":"test_tenant_membership_01","description":"Membership primary tenant"}'`
    And I run `geonic admin tenants list --format json`
    And I save the ID from the JSON output where "name" is "test_tenant_membership_01" as TENANT1
    And I run `geonic admin users create '{"email":"membership01@example.com","password":"TestPassword123!","role":"user","primaryTenantId":"$TENANT1"}'` replacing vars
    And I run `geonic admin users list --format json`
    And I save the ID from the JSON output where "email" is "membership01@example.com" as USER1
    And I run `geonic admin tenants create '{"name":"test_tenant_membership_02","description":"Membership second tenant"}'`
    And I run `geonic admin tenants list --format json`
    And I save the ID from the JSON output where "name" is "test_tenant_membership_02" as TENANT2
    When I run `geonic admin tenants add-user $TENANT2 $USER1 --role tenant_admin` replacing vars
    Then the exit code should be 0
    And the output should contain "User added to tenant."
    When I run `geonic admin tenants users $TENANT2` replacing vars
    Then the exit code should be 0
    And stdout should be valid JSON
    And the output should contain "membership01@example.com"
    When I run `geonic admin users tenants $USER1` replacing vars
    Then the exit code should be 0
    And stdout should be valid JSON
    And the output should contain "test_tenant_membership_02"
    When I run `geonic admin tenants remove-user $TENANT2 $USER1` replacing vars
    Then the exit code should be 0
    And the output should contain "User removed from tenant."
