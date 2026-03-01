@extended-api
Feature: Temporal entity management
  As a CLI user
  I want to manage temporal entities
  So that I can track entity changes over time

  Scenario: List temporal entities when none exist
    Given I am logged in
    When I run "geonic temporal entities list"
    Then the exit code should be 0
    And stdout should contain "[]"

  Scenario: Create a temporal entity
    Given I am logged in
    When I create a temporal entity "urn:ngsi-ld:Room:T01" of type "Room"
    Then the exit code should be 0
    And the output should contain "Temporal entity created."

  Scenario: List temporal entities after creation
    Given I am logged in
    And I create a temporal entity "urn:ngsi-ld:Room:T02" of type "Room"
    When I run "geonic temporal entities list"
    Then the exit code should be 0
    And the output should contain "urn:ngsi-ld:Room:T02"

  Scenario: Get a temporal entity by ID
    Given I am logged in
    And I create a temporal entity "urn:ngsi-ld:Room:T03" of type "Room"
    When I run "geonic temporal entities get urn:ngsi-ld:Room:T03"
    Then the exit code should be 0
    And stdout should be valid JSON
    And the JSON output should have key "id"

  Scenario: Delete a temporal entity
    Given I am logged in
    And I create a temporal entity "urn:ngsi-ld:Room:T04" of type "Room"
    When I run "geonic temporal entities delete urn:ngsi-ld:Room:T04"
    Then the exit code should be 0
    And the output should contain "Temporal entity deleted."

  Scenario: List temporal entities with type filter
    Given I am logged in
    And I create a temporal entity "urn:ngsi-ld:Room:T05" of type "Room"
    When I run "geonic temporal entities list --type Room"
    Then the exit code should be 0
    And the output should contain "urn:ngsi-ld:Room:T05"

  Scenario: Temporal entityOperations query
    Given I am logged in
    And I create a temporal entity "urn:ngsi-ld:Room:T06" of type "Room"
    When I run "geonic temporal entityOperations query '{\"entities\":[{\"type\":\"Room\"}]}'"
    Then the exit code should be 0
    And stdout should be valid JSON
