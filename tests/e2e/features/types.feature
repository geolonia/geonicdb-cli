Feature: Entity types
  As a CLI user
  I want to browse entity types
  So that I can discover what data is available

  Scenario: List entity types
    Given I am logged in
    And I run `geonic entities create '{"id":"urn:ngsi-ld:Room:100","type":"Room"}'`
    When I run `geonic types list`
    Then the exit code should be 0
    And the output should contain "Room"

  Scenario: Get entity type details
    Given I am logged in
    And I run `geonic entities create '{"id":"urn:ngsi-ld:Room:101","type":"Room"}'`
    When I run `geonic types get Room`
    Then the exit code should be 0
    And stdout should be valid JSON

  @issue-172
  Scenario: List entity types as unwrapped JSON array
    Given I am logged in
    And I run `geonic entities create '{"id":"urn:ngsi-ld:Room:1721","type":"Room"}'`
    When I run `geonic types list --format json`
    Then the exit code should be 0
    And stdout should be valid JSON
    And the output should contain "Room"
    And the output should not contain "EntityTypeList"

  @issue-172
  Scenario: List entity types in table without wrapper metadata
    Given I am logged in
    And I run `geonic entities create '{"id":"urn:ngsi-ld:Room:1722","type":"Room"}'`
    When I run `geonic types list --format table`
    Then the exit code should be 0
    And the output should contain "Room"
    And the output should not contain "@context"

  @issue-172
  Scenario: List entity type details with --details
    Given I am logged in
    And I run `geonic entities create '{"id":"urn:ngsi-ld:Room:1723","type":"Room","temperature":{"type":"Property","value":26}}'`
    When I run `geonic types list --details --format json`
    Then the exit code should be 0
    And stdout should be valid JSON
    And the output should contain "\"type\": \"EntityType\""
    And the output should contain "\"typeName\": \"Room\""
    And the output should contain "attributeNames"
