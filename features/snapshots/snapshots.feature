@extended-api
Feature: Snapshot management
  As a CLI user
  I want to manage entity snapshots
  So that I can save and restore entity state

  Scenario: List snapshots when none exist
    Given I am logged in
    When I run "geonic snapshots list"
    Then the exit code should be 0

  Scenario: Create a snapshot
    Given I am logged in
    When I run "geonic snapshots create"
    Then the exit code should be 0
    And the output should contain "Snapshot created."

  Scenario: List snapshots after creation
    Given I am logged in
    And I run "geonic snapshots create"
    When I get the snapshot ID from the list
    Then the exit code should be 0

  Scenario: Get a snapshot by ID
    Given I am logged in
    And I run "geonic snapshots create"
    And I get the snapshot ID from the list
    When I get the snapshot by ID
    Then the exit code should be 0
    And stdout should be valid JSON

  Scenario: Delete a snapshot
    Given I am logged in
    And I run "geonic snapshots create"
    And I get the snapshot ID from the list
    When I delete the snapshot
    Then the exit code should be 0
    And the output should contain "Snapshot deleted."

  Scenario: Clone a snapshot
    Given I am logged in
    And I run "geonic snapshots create"
    And I get the snapshot ID from the list
    When I clone the snapshot
    Then the exit code should be 0
