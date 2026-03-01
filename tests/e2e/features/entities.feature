Feature: Entity management
  As a CLI user
  I want to manage context entities
  So that I can create, read, update, and delete IoT data

  Scenario: List entities when none exist
    Given I am logged in
    When I run "geonic entities list"
    Then the exit code should be 0
    And stdout should be valid JSON

  Scenario: Create an entity
    Given I am logged in
    When I create entity "Room:001" of type "Room"
    Then the exit code should be 0
    And the output should contain "Entity created."

  Scenario: Get an entity by ID
    Given I am logged in
    And I create entity "Room:002" of type "Room"
    When I run "geonic entities get urn:ngsi-ld:Room:002"
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

  Scenario: Update an entity
    Given I am logged in
    And I create entity "Room:030" of type "Room"
    When I update entity "Room:030" with '{"temperature":{"value":25,"type":"Property"}}'
    Then the exit code should be 0
    And the output should contain "Entity updated."

  Scenario: Delete an entity
    Given I am logged in
    And I create entity "Room:040" of type "Room"
    When I run "geonic entities delete urn:ngsi-ld:Room:040"
    Then the exit code should be 0
    And the output should contain "Entity deleted."

  Scenario: Get non-existent entity returns error
    Given I am logged in
    When I run "geonic entities get urn:ngsi-ld:NonExistent:999"
    Then the exit code should be 1

  Scenario: List entities without authentication
    Given I am not logged in
    When I run "geonic entities list"
    Then the exit code should be 1

  @wip
  Scenario: Replace entity attributes
    # Server does not support PUT on /entities/{id}/attrs
    Given I am logged in
    And I create entity "Room:050" of type "Room"
    When I run "geonic entities replace urn:ngsi-ld:Room:050 '{\"temperature\":{\"value\":30,\"type\":\"Property\"}}'"
    Then the exit code should be 0
    And the output should contain "Entity replaced."

  Scenario: Upsert entities
    Given I am logged in
    When I run "geonic entities upsert '[{\"id\":\"urn:ngsi-ld:Room:060\",\"type\":\"Room\"},{\"id\":\"urn:ngsi-ld:Room:061\",\"type\":\"Room\"}]'"
    Then the exit code should be 0
    And the output should contain "Entity upserted."

  Scenario: List entities with limit
    Given I am logged in
    And I create entity "Room:070" of type "Room"
    And I create entity "Room:071" of type "Room"
    And I create entity "Room:072" of type "Room"
    When I run "geonic entities list --limit 2"
    Then the exit code should be 0
    And stdout should be valid JSON

  Scenario: List entities with id-pattern
    Given I am logged in
    And I create entity "Sensor:080" of type "Sensor"
    And I create entity "Sensor:081" of type "Sensor"
    And I create entity "Room:080" of type "Room"
    When I run "geonic entities list --id-pattern Sensor"
    Then the exit code should be 0
    And the output should contain "Sensor:080"
    And the output should not contain "Room:080"

  @wip
  Scenario: List entities with query filter
    # Server query filter (NGSI-LD q parameter) not fully supported
    Given I am logged in
    And I create entity "Room:090" of type "Room"
    When I update entity "Room:090" with '{"temperature":{"value":35,"type":"Property"}}'
    And I run "geonic entities list --query temperature>30"
    Then the exit code should be 0
    And the output should contain "Room:090"

  Scenario: List entities with order-by
    Given I am logged in
    And I create entity "Room:100" of type "Room"
    And I create entity "Room:101" of type "Room"
    When I run "geonic entities list --type Room --order-by id"
    Then the exit code should be 0
    And stdout should be valid JSON
