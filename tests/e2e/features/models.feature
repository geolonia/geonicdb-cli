@extended-api @wip
Feature: Custom data model management
  # Server requires tenantId for model creation; skipping until multi-tenant test support
  As a CLI user
  I want to manage custom data models
  So that I can define entity schemas

  Scenario: List models when none exist
    Given I am logged in
    When I run "geonic models list"
    Then the exit code should be 0

  Scenario: Create a model
    Given I am logged in
    When I create a model "TestModel01"
    Then the exit code should be 0
    And the output should contain "Model created."

  Scenario: List models after creation
    Given I am logged in
    And I create a model "TestModel02"
    When I run "geonic models list"
    Then the exit code should be 0
    And the output should contain "TestModel02"

  Scenario: Get a model by ID
    Given I am logged in
    And I create a model "TestModel03"
    And I get the model ID from the list
    When I get the model by ID
    Then the exit code should be 0
    And stdout should be valid JSON

  Scenario: Delete a model
    Given I am logged in
    And I create a model "TestModel04"
    And I get the model ID from the list
    When I delete the model
    Then the exit code should be 0
    And the output should contain "Model deleted."

  Scenario: custom-data-models alias works
    Given I am logged in
    When I run "geonic custom-data-models list"
    Then the exit code should be 0
