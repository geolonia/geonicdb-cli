Feature: Entity management
  As a CLI user
  I want to manage context entities
  So that I can create, read, update, and delete IoT data

  Scenario: List entities when none exist
    Given I am logged in
    When I run `geonic entities list`
    Then the exit code should be 0
    And stdout should be valid JSON

  Scenario: Create an entity
    Given I am logged in
    When I run `geonic entities create '{"id":"urn:ngsi-ld:Room:001","type":"Room"}'`
    Then the exit code should be 0
    And the output should contain "Entity created."

  Scenario: Get an entity by ID
    Given I am logged in
    And I run `geonic entities create '{"id":"urn:ngsi-ld:Room:002","type":"Room"}'`
    When I run `geonic entities get urn:ngsi-ld:Room:002`
    Then the exit code should be 0
    And stdout should be valid JSON
    And the JSON output should have key "id"

  Scenario: List shows created entities
    Given I am logged in
    And I run `geonic entities create '{"id":"urn:ngsi-ld:Room:003","type":"Room"}'`
    When I run `geonic entities list`
    Then the exit code should be 0
    And the output should contain "Room:003"

  Scenario: Filter entities by type
    Given I am logged in
    And I run `geonic entities create '{"id":"urn:ngsi-ld:Room:010","type":"Room"}'`
    And I run `geonic entities create '{"id":"urn:ngsi-ld:Car:010","type":"Car"}'`
    When I run `geonic entities list --type Room`
    Then the exit code should be 0
    And the output should contain "Room:010"
    And the output should not contain "Car:010"

  Scenario: List entities with count
    Given I am logged in
    And I run `geonic entities create '{"id":"urn:ngsi-ld:Room:020","type":"Room"}'`
    When I run `geonic entities list --count`
    Then the exit code should be 0

  Scenario: Update an entity
    Given I am logged in
    And I run `geonic entities create '{"id":"urn:ngsi-ld:Room:030","type":"Room"}'`
    When I run `geonic entities update urn:ngsi-ld:Room:030 '{"temperature":{"value":25,"type":"Property"}}'`
    Then the exit code should be 0
    And the output should contain "Entity updated."

  Scenario: Delete an entity
    Given I am logged in
    And I run `geonic entities create '{"id":"urn:ngsi-ld:Room:040","type":"Room"}'`
    When I run `geonic entities delete urn:ngsi-ld:Room:040`
    Then the exit code should be 0
    And the output should contain "Entity deleted."

  Scenario: Get non-existent entity returns error
    Given I am logged in
    When I run `geonic entities get urn:ngsi-ld:NonExistent:999`
    Then the exit code should be 1

  Scenario: List entities without authentication
    Given I am not logged in
    When I run `geonic entities list`
    Then the exit code should be 1

  @wip
  Scenario: Replace entity attributes
    # Server does not support PUT on /entities/{id}/attrs
    Given I am logged in
    And I run `geonic entities create '{"id":"urn:ngsi-ld:Room:050","type":"Room"}'`
    When I run `geonic entities replace urn:ngsi-ld:Room:050 '{"temperature":{"value":30,"type":"Property"}}'`
    Then the exit code should be 0
    And the output should contain "Entity replaced."

  Scenario: Upsert entities
    Given I am logged in
    When I run `geonic entities upsert '[{"id":"urn:ngsi-ld:Room:060","type":"Room"},{"id":"urn:ngsi-ld:Room:061","type":"Room"}]'`
    Then the exit code should be 0
    And the output should contain "Entity upserted."

  Scenario: List entities with limit
    Given I am logged in
    And I run `geonic entities create '{"id":"urn:ngsi-ld:Room:070","type":"Room"}'`
    And I run `geonic entities create '{"id":"urn:ngsi-ld:Room:071","type":"Room"}'`
    And I run `geonic entities create '{"id":"urn:ngsi-ld:Room:072","type":"Room"}'`
    When I run `geonic entities list --limit 2`
    Then the exit code should be 0
    And stdout should be valid JSON

  Scenario: List entities with id-pattern
    Given I am logged in
    And I run `geonic entities create '{"id":"urn:ngsi-ld:Sensor:080","type":"Sensor"}'`
    And I run `geonic entities create '{"id":"urn:ngsi-ld:Sensor:081","type":"Sensor"}'`
    And I run `geonic entities create '{"id":"urn:ngsi-ld:Room:080","type":"Room"}'`
    When I run `geonic entities list --id-pattern Sensor`
    Then the exit code should be 0
    And the output should contain "Sensor:080"
    And the output should not contain "Room:080"

  @wip
  Scenario: List entities with query filter
    # Server query filter (NGSI-LD q parameter) not fully supported
    Given I am logged in
    And I run `geonic entities create '{"id":"urn:ngsi-ld:Room:090","type":"Room"}'`
    And I run `geonic entities update urn:ngsi-ld:Room:090 '{"temperature":{"value":35,"type":"Property"}}'`
    And I run `geonic entities list --query temperature>30`
    Then the exit code should be 0
    And the output should contain "Room:090"

  Scenario: List entities with order-by
    Given I am logged in
    And I run `geonic entities create '{"id":"urn:ngsi-ld:Room:100","type":"Room"}'`
    And I run `geonic entities create '{"id":"urn:ngsi-ld:Room:101","type":"Room"}'`
    When I run `geonic entities list --type Room --order-by id`
    Then the exit code should be 0
    And stdout should be valid JSON

  # --key-values flag

  Scenario: List entities with --key-values flag
    Given I am logged in
    And I run `geonic entities create '{"id":"urn:ngsi-ld:Room:KV1","type":"Room","temperature":{"value":25,"type":"Property"}}'`
    When I run `geonic entities list --type Room --key-values`
    Then the exit code should be 0
    And stdout should be valid JSON
    And the output should not contain "\"type\": \"Property\""

  Scenario: Get entity with --key-values flag
    Given I am logged in
    And I run `geonic entities create '{"id":"urn:ngsi-ld:Room:KV2","type":"Room","temperature":{"value":30,"type":"Property"}}'`
    When I run `geonic entities get urn:ngsi-ld:Room:KV2 --key-values`
    Then the exit code should be 0
    And stdout should be valid JSON
    And the JSON output should have key "temperature"
    And the output should not contain "\"type\": \"Property\""

  Scenario: List entities with --key-values and --count combined
    Given I am logged in
    And I run `geonic entities create '{"id":"urn:ngsi-ld:Room:KV3","type":"Room","temperature":{"value":20,"type":"Property"}}'`
    When I run `geonic entities list --type Room --key-values --count`
    Then the exit code should be 0
    And stdout should be valid JSON

  # Stdin and JSON5 input

  Scenario: Create entity via stdin (without -)
    Given I am logged in
    When I run `geonic entities create` with stdin:
      """
      {"id":"urn:ngsi-ld:Room:S01","type":"Room"}
      """
    Then the exit code should be 0
    And the output should contain "Entity created."

  Scenario: Create entity with JSON5 syntax
    Given I am logged in
    When I run `geonic entities create` with stdin:
      """
      {id: 'urn:ngsi-ld:Room:S02', type: 'Room'}
      """
    Then the exit code should be 0
    And the output should contain "Entity created."
