@extended-api
Feature: Custom data model management
  # Model creation requires a tenant-scoped actor; the e2e hooks provision the
  # "e2e_test" tenant and a tenant_admin, and "I am logged in" uses that admin.
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
    # モデルの ID はエンティティタイプ (API: GET /custom-data-models/{type})
    Given I am logged in
    And I run `geonic models create '{"type":"TestModel03","domain":"test","description":"Model TestModel03","propertyDetails":{"temperature":{"ngsiType":"Property","valueType":"Number","example":25},"humidity":{"ngsiType":"Property","valueType":"Number","example":60}}}'`
    When I run `geonic models get TestModel03`
    Then the exit code should be 0
    And stdout should be valid JSON
    And the output should contain "TestModel03"

  Scenario: Delete a model
    # モデルの ID はエンティティタイプ (API: DELETE /custom-data-models/{type})
    Given I am logged in
    And I run `geonic models create '{"type":"TestModel04","domain":"test","description":"Model TestModel04","propertyDetails":{"temperature":{"ngsiType":"Property","valueType":"Number","example":25},"humidity":{"ngsiType":"Property","valueType":"Number","example":60}}}'`
    When I run `geonic models delete TestModel04`
    Then the exit code should be 0
    And the output should contain "Model deleted."

  Scenario: custom-data-models alias works
    Given I am logged in
    When I run `geonic custom-data-models list`
    Then the exit code should be 0

  Scenario: Declare unique constraints and enforce duplicates (geonicdb#1268)
    Given I am logged in
    When I run `geonic models create '{"type":"UcReservation","domain":"test","description":"Reservation with unique constraint","propertyDetails":{"room":{"ngsiType":"Property","valueType":"string","example":"R1"},"date":{"ngsiType":"Property","valueType":"string","example":"2026-07-15"}},"uniqueConstraints":[{"name":"no-double-booking","fields":["room","date"]}]}' --service e2e_test`
    Then the exit code should be 0
    And the output should contain "Model created."
    # models get shows the constraint (readable form in table format)
    When I run `geonic models get UcReservation --format table --service e2e_test`
    Then the exit code should be 0
    And the output should contain "no-double-booking(room, date)"
    # first entity is accepted
    When I run `geonic entities create '{"id":"urn:ngsi-ld:UcReservation:001","type":"UcReservation","room":{"type":"Property","value":"R1"},"date":{"type":"Property","value":"2026-07-15"}}' --service e2e_test`
    Then the exit code should be 0
    # duplicate combination is rejected with the violated constraint name and a hint
    When I run `geonic entities create '{"id":"urn:ngsi-ld:UcReservation:002","type":"UcReservation","room":{"type":"Property","value":"R1"},"date":{"type":"Property","value":"2026-07-15"}}' --service e2e_test`
    Then the exit code should be 1
    And the output should contain "violates unique constraint 'no-double-booking'"
    And stderr should contain "geonic models get"
    # a different combination is accepted
    When I run `geonic entities create '{"id":"urn:ngsi-ld:UcReservation:003","type":"UcReservation","room":{"type":"Property","value":"R2"},"date":{"type":"Property","value":"2026-07-15"}}' --service e2e_test`
    Then the exit code should be 0

  Scenario: Remove unique constraints via update (geonicdb#1268)
    Given I am logged in
    And I run `geonic models create '{"type":"UcSlot","domain":"test","description":"Slot with removable constraint","propertyDetails":{"code":{"ngsiType":"Property","valueType":"string","example":"A1"}},"uniqueConstraints":[{"name":"unique-code","fields":["code"]}]}' --service e2e_test`
    And I run `geonic entities create '{"id":"urn:ngsi-ld:UcSlot:001","type":"UcSlot","code":{"type":"Property","value":"A1"}}' --service e2e_test`
    When I run `geonic entities create '{"id":"urn:ngsi-ld:UcSlot:002","type":"UcSlot","code":{"type":"Property","value":"A1"}}' --service e2e_test`
    Then the exit code should be 1
    And the output should contain "unique-code"
    # replacing the list with [] removes all constraints
    When I run `geonic models update UcSlot '{"uniqueConstraints":[]}' --service e2e_test`
    Then the exit code should be 0
    And the output should contain "Model updated."
    When I run `geonic entities create '{"id":"urn:ngsi-ld:UcSlot:002","type":"UcSlot","code":{"type":"Property","value":"A1"}}' --service e2e_test`
    Then the exit code should be 0
