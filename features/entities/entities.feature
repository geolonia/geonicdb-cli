Feature: Entity management
  As a CLI user
  I want to manage context entities
  So that I can create, read, update, and delete IoT data

  Scenario: List entities when none exist
    Given I am logged in
    When I run "geonic entities list"
    Then the exit code should be 0
    And stdout should contain "[]"

  Scenario: Create an entity
    Given I am logged in
    When I create entity "Room:001" of type "Room"
    Then the exit code should be 0
    And the output should contain "Entity created."

  Scenario: Get an entity by ID
    Given I am logged in
    And I create entity "Room:002" of type "Room"
    When I run "geonic entities get Room:002"
    Then the exit code should be 0
    And stdout should be valid JSON
    And the JSON output should have key "id"

  Scenario: List shows created entities
    Given I am logged in
    And I create entity "Room:003" of type "Room"
    When I run "geonic entities list"
    Then the exit code should be 0
    And the output should contain "Room:003"

  Scenario: Filter entities by type
    Given I am logged in
    And I create entity "Room:010" of type "Room"
    And I create entity "Car:010" of type "Car"
    When I run "geonic entities list --type Room"
    Then the exit code should be 0
    And the output should contain "Room:010"
    And the output should not contain "Car:010"

  Scenario: List entities with count
    Given I am logged in
    And I create entity "Room:020" of type "Room"
    When I run "geonic entities list --count"
    Then the exit code should be 0
    And the output should contain "Count:"

  Scenario: Update an entity
    Given I am logged in
    And I create entity "Room:030" of type "Room"
    When I update entity "Room:030" with '{"temperature":{"value":25,"type":"Number"}}'
    Then the exit code should be 0
    And the output should contain "Entity updated."

  Scenario: Delete an entity
    Given I am logged in
    And I create entity "Room:040" of type "Room"
    When I run "geonic entities delete Room:040"
    Then the exit code should be 0
    And the output should contain "Entity deleted."

  Scenario: Get non-existent entity returns error
    Given I am logged in
    When I run "geonic entities get NonExistent:999"
    Then the exit code should be 1

  Scenario: List entities without authentication
    Given I am not logged in
    When I run "geonic entities list"
    Then the exit code should be 1
