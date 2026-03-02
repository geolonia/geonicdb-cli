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
