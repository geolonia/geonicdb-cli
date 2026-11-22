@extended-api
Feature: Entity attribute management
  As a CLI user
  I want to manage individual entity attributes
  So that I can add, update, and delete specific attributes

  Scenario: List entity attributes
    Given I am logged in
    And I run `geonic entities create '{"id":"urn:ngsi-ld:Room:A01","type":"Room"}'`
    When I run `geonic entities attrs list urn:ngsi-ld:Room:A01`
    Then the exit code should be 0
    And stdout should be valid JSON

  Scenario: Add attributes to an entity
    Given I am logged in
    And I run `geonic entities create '{"id":"urn:ngsi-ld:Room:A02","type":"Room"}'`
    When I run `geonic entities attrs add urn:ngsi-ld:Room:A02 '{"humidity":{"value":60,"type":"Property"}}'`
    Then the exit code should be 0
    And the output should contain "Attributes added."

  Scenario: Get a specific attribute
    Given I am logged in
    And I run `geonic entities create '{"id":"urn:ngsi-ld:Room:A03","type":"Room"}'`
    And I run `geonic entities attrs add urn:ngsi-ld:Room:A03 '{"humidity":{"value":60,"type":"Property"}}'`
    When I run `geonic entities attrs get urn:ngsi-ld:Room:A03 humidity`
    Then the exit code should be 0
    And stdout should be valid JSON

  Scenario: Update a specific attribute
    Given I am logged in
    And I run `geonic entities create '{"id":"urn:ngsi-ld:Room:A04","type":"Room"}'`
    And I run `geonic entities attrs add urn:ngsi-ld:Room:A04 '{"humidity":{"value":60,"type":"Property"}}'`
    When I run `geonic entities attrs update urn:ngsi-ld:Room:A04 humidity '{"value":80,"type":"Property"}'`
    Then the exit code should be 0
    And the output should contain "Attribute updated."
    When I run `geonic entities attrs get urn:ngsi-ld:Room:A04 humidity`
    Then the exit code should be 0
    And the output should contain "80"

  Scenario: Delete a specific attribute
    Given I am logged in
    And I run `geonic entities create '{"id":"urn:ngsi-ld:Room:A05","type":"Room"}'`
    And I run `geonic entities attrs add urn:ngsi-ld:Room:A05 '{"humidity":{"value":60,"type":"Property"}}'`
    And I run `geonic entities attrs add urn:ngsi-ld:Room:A05 '{"pressure":{"value":1013,"type":"Property"}}'`
    When I run `geonic entities attrs delete urn:ngsi-ld:Room:A05 humidity`
    Then the exit code should be 0
    And the output should contain "Attribute deleted."
    When I run `geonic entities attrs list urn:ngsi-ld:Room:A05`
    Then the exit code should be 0
    And the output should not contain "humidity"

  # ETSI TS 104 176 clause 7.6.3.1
  @issue-267
  Scenario: Request only the value of an individual attribute
    Given I am logged in
    When I run `geonic entities attrs value urn:ngsi-ld:Room:A01 https://example.org/temperature --dataset-id urn:ngsi-ld:Dataset:1 --lang ja --type Property --dry-run`
    Then the exit code should be 0
    And the output should contain "/entities/urn%3Angsi-ld%3ARoom%3AA01/attrs/https%3A%2F%2Fexample.org%2Ftemperature/value"
    And the output should contain "datasetId=urn%3Angsi-ld%3ADataset%3A1"
    And the output should contain "lang=ja"
    And the output should contain "type=Property"
    And the output should contain "Accept: application/json"

  @issue-267
  Scenario: Omit optional attribute value selectors when absent
    Given I am logged in
    When I run `geonic entities attrs value urn:ngsi-ld:Room:A01 temperature --dry-run`
    Then the exit code should be 0
    And the output should contain "/attrs/temperature/value'"
    And the output should not contain "datasetId="
