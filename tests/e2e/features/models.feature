@extended-api @wip
Feature: Custom data model management
  # Server requires tenantId for model creation; skipping until multi-tenant test support
  As a CLI user
  I want to manage custom data models
  So that I can define entity schemas

  Scenario: List models when none exist
    Given I am logged in
    When I run `geonic models list`
    Then the exit code should be 0

  Scenario: Create a model
    Given I am logged in
    When I run `geonic models create '{"type":"TestModel01","domain":"test","description":"Model TestModel01","propertyDetails":{"temperature":{"ngsiType":"Property","valueType":"Number","example":25},"humidity":{"ngsiType":"Property","valueType":"Number","example":60}}}'`
    Then the exit code should be 0
    And the output should contain "Model created."

  Scenario: List models after creation
    Given I am logged in
    And I run `geonic models create '{"type":"TestModel02","domain":"test","description":"Model TestModel02","propertyDetails":{"temperature":{"ngsiType":"Property","valueType":"Number","example":25},"humidity":{"ngsiType":"Property","valueType":"Number","example":60}}}'`
    When I run `geonic models list`
    Then the exit code should be 0
    And the output should contain "TestModel02"

  Scenario: Get a model by ID
    Given I am logged in
    And I run `geonic models create '{"type":"TestModel03","domain":"test","description":"Model TestModel03","propertyDetails":{"temperature":{"ngsiType":"Property","valueType":"Number","example":25},"humidity":{"ngsiType":"Property","valueType":"Number","example":60}}}'`
    And I run `geonic models list --format json`
    And I save the ID from the JSON output
    When I run `geonic models get $ID` replacing ID
    Then the exit code should be 0
    And stdout should be valid JSON

  Scenario: Delete a model
    Given I am logged in
    And I run `geonic models create '{"type":"TestModel04","domain":"test","description":"Model TestModel04","propertyDetails":{"temperature":{"ngsiType":"Property","valueType":"Number","example":25},"humidity":{"ngsiType":"Property","valueType":"Number","example":60}}}'`
    And I run `geonic models list --format json`
    And I save the ID from the JSON output
    When I run `geonic models delete $ID` replacing ID
    Then the exit code should be 0
    And the output should contain "Model deleted."

  Scenario: custom-data-models alias works
    Given I am logged in
    When I run `geonic custom-data-models list`
    Then the exit code should be 0
