@contexts
Feature: JSON-LD @context registration via `geonic contexts`
  As a CLI user working with a custom vocabulary
  I want to register and manage @context documents on the tenant
  So that I can pass the registered URL to --context without using curl

  # Wraps GET/POST/DELETE /ngsi-ld/v1/jsonldContexts (geolonia/geonicdb-cli#241).

  Scenario: Create prints a URL that --context can use for compaction
    Given I am logged in
    When I run `geonic contexts create '{"@context":{"Vehicle":"https://example-vocab/ns#Vehicle","plateNumber":"https://example-vocab/ns#plateNumber"}}'`
    Then the exit code should be 0
    And stdout should be valid JSON
    And the JSON output should have key "url"
    And the output should contain "Context created."
    Given I save the url from the JSON output
    And an entity "urn:ngsi-ld:Vehicle:ctx-cmd-1" exists using the custom vocabulary
    When I run `geonic entities get urn:ngsi-ld:Vehicle:ctx-cmd-1 --context $URL` replacing URL
    Then the exit code should be 0
    And the JSON output key "type" should be "Vehicle"
    And the JSON output should have key "plateNumber"

  Scenario: List, get, and delete a Hosted context
    Given I am logged in
    When I run `geonic contexts create '{"@context":{"Sensor":"https://example-vocab/ns#Sensor"}}'`
    Then the exit code should be 0
    Given I save the url from the JSON output
    When I run `geonic contexts list --kind Hosted`
    Then the exit code should be 0
    And stdout should be valid JSON
    When I run `geonic contexts list --details --kind Hosted`
    Then the exit code should be 0
    And the output should contain "Hosted"
    When I run `geonic contexts get $ID` replacing ID
    Then the exit code should be 0
    And stdout should be valid JSON
    And the JSON output should have key "@context"
    When I run `geonic contexts delete $ID` replacing ID
    Then the exit code should be 0
    And the output should contain "Context deleted."

  Scenario: jsonld-contexts alias works
    Given I am logged in
    When I run `geonic jsonld-contexts list`
    Then the exit code should be 0
