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

  # geonicdb-cli#186: clause 6.3.5 "No mixes" — under application/ld+json (which
  # the CLI always sends) a POST/PATCH/PUT must take its @context from the body,
  # and a JSON-LD Link header on such a request is rejected with 400 by the
  # server (geolonia/geonicdb#1924). The Link channel is for reads only.
  # https://cim.etsi.org/NGSI-LD/official/clause-6.html
  Scenario: A write sends the @context in the body, never as a Link header
    When I run `geonic entities create '{"id":"urn:ngsi-ld:Vehicle:e2e11","type":"Vehicle","plateNumber":{"type":"Property","value":"LNK-000"}}' --context https://example.org/e2e-vocab.jsonld --verbose`
    Then the exit code should be 0
    And stderr should not contain "> Link:"
    And stderr should contain "e2e-vocab.jsonld"

  Scenario: A read still sends the @context as a Link header
    Given an entity "urn:ngsi-ld:Vehicle:e2e12" exists using the custom vocabulary
    When I run `geonic entities get urn:ngsi-ld:Vehicle:e2e12 --context https://example.org/e2e-vocab.jsonld --verbose`
    Then the exit code should be 0
    And stderr should contain "> Link:"
    And the JSON output key "type" should be "Vehicle"

  # geonicdb-cli#189: every NGSI-LD write body must carry a @context inline —
  # since geolonia/geonicdb#2065 the server rejects a bare body with 400 (or a
  # per-element 207 for batches). The core context is injected when the user
  # supplies none; the body assertion below is deliberate, because a green
  # status alone could come from a server that stopped enforcing the rule.
  Scenario: A write without --context gets the core @context injected into the body
    When I run `geonic subscriptions create '{"type":"Subscription","entities":[{"type":"Vehicle"}],"notification":{"endpoint":{"uri":"http://localhost:3000/notify"}}}' --verbose`
    Then the exit code should be 0
    And stderr should contain "ngsi-ld-core-context.jsonld"

  # The over-injection guard: entityOperations/delete sends bare ID strings that
  # have no place for a @context (clause 5.6.10.3) — wrapping them would make
  # the server reject the whole request.
  Scenario: Batch delete ID strings are not wrapped with a @context
    Given an entity "urn:ngsi-ld:Vehicle:e2e13" exists using the custom vocabulary
    When I run `geonic batch delete '["urn:ngsi-ld:Vehicle:e2e13"]' --verbose`
    Then the exit code should be 0
    And stderr should not contain "@context"

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

  # A non-ASCII URI cannot go into a header (ByteString), and used to surface as
  # an unreadable TypeError from deep inside fetch.
  Scenario: A non-ASCII @context URI is rejected with an actionable message
    When I run `geonic entities list --context https://example.org/日本語.jsonld`
    Then the exit code should be 1
    And stderr should contain "must be ASCII"
    And stderr should contain "%E6%97%A5%E6%9C%AC%E8%AA%9E"
    And stderr should not contain "ByteString"

  # Exactly the URI the rejection above tells the user to use, so the error
  # message and the accepted form cannot drift apart.
  Scenario: The percent-encoded form the error suggests is accepted and sent
    When I run `geonic entities list --context https://example.org/%E6%97%A5%E6%9C%AC%E8%AA%9E.jsonld --dry-run`
    Then the exit code should be 0
    And stdout should contain "%E6%97%A5%E6%9C%AC%E8%AA%9E.jsonld"
    And stdout should contain "json-ld#context"

  Scenario: config set rejects an invalid @context instead of saving it
    When I run `geonic config set context not-a-url`
    Then the exit code should be 1
    And the config should not have key "context"
