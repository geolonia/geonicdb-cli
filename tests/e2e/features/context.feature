Feature: JSON-LD @context on NGSI-LD requests
  As a CLI user working with a custom vocabulary
  I want to send a JSON-LD @context with my requests
  So that responses come back with short terms instead of fully qualified URIs

  # GeonicDB compacts a response using only the @context that the request itself
  # supplied; unmapped terms are rendered as Fully Qualified Names.
  # ETSI GS CIM 009 clause 5.5.5 / 5.5.7 — https://cim.etsi.org/NGSI-LD/official/clause-5.html
  # Regression guard for geolonia/geonicdb-cli#177 (server side: geolonia/geonicdb#1733).

  Background:
    Given I am logged in
    And a JSON-LD context "https://example.org/e2e-vocab.jsonld" is registered with:
      """
      {
        "Vehicle": "https://example-vocab/ns#Vehicle",
        "plateNumber": "https://example-vocab/ns#plateNumber"
      }
      """

  # Reproduces the issue: data written elsewhere with a custom vocabulary is
  # unreadable in short form because the CLI could not send a @context.
  Scenario: Reading without a context yields fully qualified names
    Given an entity "urn:ngsi-ld:Vehicle:e2e1" exists using the custom vocabulary
    When I run `geonic entities get urn:ngsi-ld:Vehicle:e2e1`
    Then the exit code should be 0
    And stdout should be valid JSON
    And the JSON output key "type" should be "https://example-vocab/ns#Vehicle"
    And the JSON output should have key "https://example-vocab/ns#plateNumber"

  Scenario: --context restores the short terms on a single-entity read
    Given an entity "urn:ngsi-ld:Vehicle:e2e2" exists using the custom vocabulary
    When I run `geonic entities get urn:ngsi-ld:Vehicle:e2e2 --context https://example.org/e2e-vocab.jsonld`
    Then the exit code should be 0
    And the JSON output key "type" should be "Vehicle"
    And the JSON output should have key "plateNumber"
    And the output should not contain "example-vocab/ns#plateNumber"

  Scenario: --context applies to list reads and to the type filter
    Given an entity "urn:ngsi-ld:Vehicle:e2e3" exists using the custom vocabulary
    When I run `geonic entities list --type Vehicle --context https://example.org/e2e-vocab.jsonld`
    Then the exit code should be 0
    And the JSON array length should be 1
    And the output should contain "plateNumber"
    And the output should not contain "example-vocab/ns#plateNumber"

  Scenario: --context applies to temporal reads
    Given a temporal entity "urn:ngsi-ld:Vehicle:e2e4" exists using the custom vocabulary
    When I run `geonic temporal entities get urn:ngsi-ld:Vehicle:e2e4 --context https://example.org/e2e-vocab.jsonld`
    Then the exit code should be 0
    And the output should not contain "example-vocab/ns#plateNumber"

  Scenario: --context applies to batch query reads
    Given an entity "urn:ngsi-ld:Vehicle:e2e5" exists using the custom vocabulary
    When I run `geonic batch query '{"type":"Vehicle"}' --context https://example.org/e2e-vocab.jsonld`
    Then the exit code should be 0
    And the JSON array length should be 1
    And the output should not contain "example-vocab/ns#plateNumber"

  # A profile default means the vocabulary does not have to be typed every time.
  Scenario: A configured default @context is used without the flag
    Given an entity "urn:ngsi-ld:Vehicle:e2e6" exists using the custom vocabulary
    And I run `geonic config set context https://example.org/e2e-vocab.jsonld`
    When I run `geonic entities get urn:ngsi-ld:Vehicle:e2e6`
    Then the exit code should be 0
    And the JSON output key "type" should be "Vehicle"

  Scenario: --context overrides the configured default
    Given an entity "urn:ngsi-ld:Vehicle:e2e7" exists using the custom vocabulary
    And a JSON-LD context "https://example.org/e2e-other.jsonld" is registered with:
      """
      { "Unrelated": "https://example-vocab/ns#Unrelated" }
      """
    And I run `geonic config set context https://example.org/e2e-other.jsonld`
    When I run `geonic entities get urn:ngsi-ld:Vehicle:e2e7 --context https://example.org/e2e-vocab.jsonld`
    Then the exit code should be 0
    And the JSON output key "type" should be "Vehicle"

  # Writes take the @context from the body under application/ld+json, so the same
  # flag has to reach the payload — otherwise it would be accepted and do nothing.
  Scenario: --context lets the CLI write with a custom vocabulary
    When I run `geonic entities create '{"id":"urn:ngsi-ld:Vehicle:e2e8","type":"Vehicle","plateNumber":{"type":"Property","value":"XYZ-999"}}' --context https://example.org/e2e-vocab.jsonld`
    Then the exit code should be 0
    When I run `geonic entities get urn:ngsi-ld:Vehicle:e2e8`
    Then the exit code should be 0
    And the JSON output key "type" should be "https://example-vocab/ns#Vehicle"
    When I run `geonic entities get urn:ngsi-ld:Vehicle:e2e8 --context https://example.org/e2e-vocab.jsonld`
    Then the exit code should be 0
    And the JSON output key "type" should be "Vehicle"
    And the JSON output should have key "plateNumber"

  Scenario: --context lets the CLI write a batch with a custom vocabulary
    When I run `geonic batch create '[{"id":"urn:ngsi-ld:Vehicle:e2e9","type":"Vehicle","plateNumber":{"type":"Property","value":"AAA-111"}}]' --context https://example.org/e2e-vocab.jsonld`
    Then the exit code should be 0
    # Reading back without the context proves the batch entity really was stored
    # under the custom vocabulary — with the core context the type would stay the
    # bare string "Vehicle" and the round-trip below would pass for the wrong reason.
    When I run `geonic entities get urn:ngsi-ld:Vehicle:e2e9`
    Then the exit code should be 0
    And the JSON output key "type" should be "https://example-vocab/ns#Vehicle"
    When I run `geonic entities get urn:ngsi-ld:Vehicle:e2e9 --context https://example.org/e2e-vocab.jsonld`
    Then the exit code should be 0
    And the JSON output key "type" should be "Vehicle"

  Scenario: An invalid @context URI is rejected before any request is made
    When I run `geonic entities list --context not-a-url`
    Then the exit code should be 1
    And stderr should contain "absolute URL"

  Scenario: A @context URI that would forge a header is rejected
    When I run `geonic entities list --context "https://example.org/a.jsonld extra"`
    Then the exit code should be 1
    And stderr should contain "must not contain"

  # geolonia/geonicdb#1818: the server reads only the first link-value, so the
  # dropped vocabularies must be announced rather than silently lost.
  Scenario: Supplying several contexts warns that only the first is applied
    Given an entity "urn:ngsi-ld:Vehicle:e2e10" exists using the custom vocabulary
    And a JSON-LD context "https://example.org/e2e-second.jsonld" is registered with:
      """
      { "Unrelated": "https://example-vocab/ns#Unrelated" }
      """
    When I run `geonic entities get urn:ngsi-ld:Vehicle:e2e10 --context https://example.org/e2e-vocab.jsonld --context https://example.org/e2e-second.jsonld`
    Then the exit code should be 0
    And stderr should contain "geonicdb#1818"
    And the JSON output key "type" should be "Vehicle"

  Scenario: config set rejects an invalid @context instead of saving it
    When I run `geonic config set context not-a-url`
    Then the exit code should be 1
    And the config should not have key "context"
