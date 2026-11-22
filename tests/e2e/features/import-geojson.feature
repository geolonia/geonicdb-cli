@issue-240
Feature: Import GeoJSON FeatureCollections
  # GeoJSON: https://www.rfc-editor.org/rfc/rfc7946#section-3.3

  Scenario: Import an AED point with a source ID field, then retrieve and query it
    Given I am logged in
    When I run `geonic import --input-format geojson --type AedLocation --id-field '#property'` with stdin:
      """
      {"type":"FeatureCollection","features":[{"type":"Feature","properties":{"#property":"240","name":"AED demo"},"geometry":{"type":"Point","coordinates":[134.045,34.340]}}]}
      """
    Then the exit code should be 0
    When I run `geonic entities get urn:ngsi-ld:AedLocation:240`
    Then the exit code should be 0
    And stdout should contain "AED demo"
    And stdout should contain "GeoProperty"
    And stdout should contain "134.045"
    When I run `geonic entities list --type AedLocation`
    Then the exit code should be 0
    And stdout should contain "urn:ngsi-ld:AedLocation:240"

  Scenario: Preserve an absolute Feature ID and import a feature without a geometry
    Given I am logged in
    When I run `geonic import --input-format geojson --type AedLocation` with stdin:
      """
      {"type":"FeatureCollection","features":[{"type":"Feature","id":"urn:ngsi-ld:AedLocation:240b","properties":{"name":"AED no location","optional":null},"geometry":null}]}
      """
    Then the exit code should be 0
    When I run `geonic entities get urn:ngsi-ld:AedLocation:240b`
    Then the exit code should be 0
    And stdout should contain "AED no location"
    And stdout should not contain '"location":'
    And stdout should not contain '"optional":'

  Scenario: Require an entity type for GeoJSON
    When I run `geonic import --dry-run --input-format geojson` with stdin:
      """
      {"type":"FeatureCollection","features":[]}
      """
    Then the exit code should be 1
    And the output should contain "--type is required"

  Scenario: Report invalid features while importing valid neighbors when requested
    Given I am logged in
    When I run `geonic import --input-format geojson --type AedLocation --continue-on-error` with stdin:
      """
      {"type":"FeatureCollection","features":[{"type":"Feature","geometry":null,"properties":{}},{"type":"Feature","id":"gml:2403","geometry":null,"properties":{"name":"Valid AED"}}]}
      """
    Then the exit code should be 1
    And the output should contain "1 succeeded, 1 failed"
    When I run `geonic entities get urn:ngsi-ld:AedLocation:_b64_Z21sOjI0MDM`
    Then the exit code should be 0
    And stdout should contain "Valid AED"

  Scenario: Reject unsupported geometries and duplicate IDs in a dry-run
    When I run `geonic import --dry-run --input-format geojson --type AedLocation` with stdin:
      """
      {"type":"FeatureCollection","features":[{"type":"Feature","id":1,"geometry":null,"properties":{}},{"type":"Feature","id":"1","geometry":null,"properties":{}},{"type":"Feature","id":2,"geometry":{"type":"Point","coordinates":[]},"properties":{}},{"type":"Feature","id":3,"geometry":{"type":"GeometryCollection","geometries":[]},"properties":{}},{"type":"Feature","id":4,"geometry":null,"properties":{"scope":"/a"}}]}
      """
    Then the exit code should be 1
    And the output should contain "would send 1 entities"
    And the output should contain "Skipped 4 invalid GeoJSON feature(s)."

  Scenario: Reject GeoJSON selectors on an async NDJSON import
    When I run `geonic import --async --dry-run --type AedLocation`
    Then the exit code should be 1
    And the output should contain "--type and --id-field require --input-format geojson."
