@extended-api
Feature: Temporal entity management
  As a CLI user
  I want to manage temporal entities
  So that I can track entity changes over time

  Scenario: List temporal entities when none exist
    Given I am logged in
    When I run `geonic temporal entities list --local`
    Then the exit code should be 0
    And stdout should contain "[]"

  Scenario: Create a temporal entity
    Given I am logged in
    When I run `geonic temporal entities create '{"id":"urn:ngsi-ld:Room:T01","type":"Room","temperature":[{"type":"Property","value":25,"observedAt":"2025-01-01T00:00:00Z"}]}'`
    Then the exit code should be 0
    And the output should contain "Temporal entity created."

  Scenario: List temporal entities after creation
    Given I am logged in
    And I run `geonic temporal entities create '{"id":"urn:ngsi-ld:Room:T02","type":"Room","temperature":[{"type":"Property","value":25,"observedAt":"2025-01-01T00:00:00Z"}]}'`
    When I run `geonic temporal entities list --local`
    Then the exit code should be 0
    And the output should contain "urn:ngsi-ld:Room:T02"

  Scenario: Get a temporal entity by ID
    Given I am logged in
    And I run `geonic temporal entities create '{"id":"urn:ngsi-ld:Room:T03","type":"Room","temperature":[{"type":"Property","value":25,"observedAt":"2025-01-01T00:00:00Z"}]}'`
    When I run `geonic temporal entities get urn:ngsi-ld:Room:T03`
    Then the exit code should be 0
    And stdout should be valid JSON
    And the JSON output should have key "id"

  Scenario: Delete a temporal entity
    Given I am logged in
    And I run `geonic temporal entities create '{"id":"urn:ngsi-ld:Room:T04","type":"Room","temperature":[{"type":"Property","value":25,"observedAt":"2025-01-01T00:00:00Z"}]}'`
    When I run `geonic temporal entities delete urn:ngsi-ld:Room:T04`
    Then the exit code should be 0
    And the output should contain "Temporal entity deleted."

  Scenario: List temporal entities with type filter
    Given I am logged in
    And I run `geonic temporal entities create '{"id":"urn:ngsi-ld:Room:T05","type":"Room","temperature":[{"type":"Property","value":25,"observedAt":"2025-01-01T00:00:00Z"}]}'`
    When I run `geonic temporal entities list --type Room`
    Then the exit code should be 0
    And the output should contain "urn:ngsi-ld:Room:T05"

  Scenario: Temporal entityOperations query
    Given I am logged in
    And I run `geonic temporal entities create '{"id":"urn:ngsi-ld:Room:T06","type":"Room","temperature":[{"type":"Property","value":25,"observedAt":"2025-01-01T00:00:00Z"}]}'`
    When I run `geonic temporal entityOperations query '{"entities":[{"type":"Room"}]}'`
    Then the exit code should be 0
    And stdout should be valid JSON

  @issue-171
  Scenario: Temporal entities list accepts NGSI-LD v1.9.1 orderBy grammar
    Given I am logged in
    And I run `geonic temporal entities create '{"id":"urn:ngsi-ld:Room:T171-1","type":"Room","temperature":[{"type":"Property","value":21,"observedAt":"2025-01-01T00:00:00Z"}]}'`
    And I run `geonic temporal entities create '{"id":"urn:ngsi-ld:Room:T171-2","type":"Room","temperature":[{"type":"Property","value":24,"observedAt":"2025-01-02T00:00:00Z"}]}'`
    When I run `geonic temporal entities list --type Room --order-by observedAt;desc`
    Then the exit code should be 0
    And stdout should be valid JSON

  @issue-171
  Scenario: Temporal entities list actually transmits orderBy incl. direction (not silently dropped)
    Given I am logged in
    When I run `geonic temporal entities list --type Room --order-by observedAt;desc --dry-run`
    Then the exit code should be 0
    And the output should contain "orderBy=observedAt%3Bdesc"

  # #181/#188: NGSI-LD temporal representation parameters.
  # https://cim.etsi.org/NGSI-LD/official/clause-6.html (clause 6.3.12, Table 6.19.3.1-1)
  @issue-181
  Scenario: Aggregated representation on the GET list path
    Given I am logged in
    And I run `geonic temporal entities create '{"id":"urn:ngsi-ld:Room:T181-1","type":"Room","temperature":[{"type":"Property","value":10,"observedAt":"2025-01-01T00:00:00Z"},{"type":"Property","value":20,"observedAt":"2025-01-01T00:30:00Z"}]}'`
    When I run `geonic temporal entities list --type Room --options aggregatedValues --aggr-methods avg --aggr-period PT1H`
    Then the exit code should be 0
    And stdout should be valid JSON
    And the output should contain "avg"

  # #188 → geolonia/geonicdb#1816: the POST batch query aggregates for real now
  # (clause 6.24.3.1 mirrors 6.18.3.2); before, these flags were a silent no-op.
  @issue-188
  Scenario: Aggregated representation on the POST entityOperations query path
    Given I am logged in
    And I run `geonic temporal entities create '{"id":"urn:ngsi-ld:Room:T188-1","type":"Room","temperature":[{"type":"Property","value":10,"observedAt":"2025-01-01T00:00:00Z"},{"type":"Property","value":30,"observedAt":"2025-01-01T00:30:00Z"}]}'`
    When I run `geonic temporal entityOperations query '{"entities":[{"type":"Room"}]}' --aggr-methods avg --aggr-period PT1H`
    Then the exit code should be 0
    And stdout should be valid JSON
    And the output should contain "avg"

  @issue-188
  Scenario: POST query actually transmits the aggregation params (not silently dropped)
    Given I am logged in
    When I run `geonic temporal entityOperations query '{"entities":[{"type":"Room"}]}' --aggr-methods avg --aggr-period PT1H --dry-run`
    Then the exit code should be 0
    And the output should contain "aggrMethods=avg"
    And the output should contain "aggrPeriodDuration=PT1H"

  @issue-188
  Scenario: Aggregation without a period fails fast before any request
    Given I am logged in
    When I run `geonic temporal entities list --aggr-methods avg`
    Then the exit code should be 1
    And stderr should contain "requires --aggr-period"
