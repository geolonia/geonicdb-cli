Feature: Batch entity operations
  As a CLI user
  I want to perform batch operations on entities
  So that I can efficiently manage multiple entities at once

  Scenario: Batch create entities
    Given I am logged in
    When I run "geonic batch create '[{\"id\":\"urn:ngsi-ld:Room:B01\",\"type\":\"Room\"},{\"id\":\"urn:ngsi-ld:Room:B02\",\"type\":\"Room\"}]'"
    Then the exit code should be 0
    When I run "geonic entities list --type Room"
    Then the exit code should be 0
    And the output should contain "urn:ngsi-ld:Room:B01"
    And the output should contain "urn:ngsi-ld:Room:B02"

  Scenario: Batch upsert entities
    Given I am logged in
    When I run "geonic batch upsert '[{\"id\":\"urn:ngsi-ld:Room:B10\",\"type\":\"Room\"},{\"id\":\"urn:ngsi-ld:Room:B11\",\"type\":\"Room\"}]'"
    Then the exit code should be 0
    When I run "geonic entities list --type Room"
    Then the exit code should be 0
    And the output should contain "urn:ngsi-ld:Room:B10"
    And the output should contain "urn:ngsi-ld:Room:B11"

  Scenario: Batch update entities
    Given I am logged in
    And I run "geonic batch create '[{\"id\":\"urn:ngsi-ld:Room:B20\",\"type\":\"Room\"},{\"id\":\"urn:ngsi-ld:Room:B21\",\"type\":\"Room\"}]'"
    When I run "geonic batch update '[{\"id\":\"urn:ngsi-ld:Room:B20\",\"type\":\"Room\",\"temperature\":{\"value\":25,\"type\":\"Property\"}},{\"id\":\"urn:ngsi-ld:Room:B21\",\"type\":\"Room\",\"temperature\":{\"value\":30,\"type\":\"Property\"}}]'"
    Then the exit code should be 0
    When I run "geonic entities get urn:ngsi-ld:Room:B20"
    Then the exit code should be 0
    And the output should contain "temperature"

  Scenario: Batch delete entities
    Given I am logged in
    And I run "geonic batch create '[{\"id\":\"urn:ngsi-ld:Room:B30\",\"type\":\"Room\"},{\"id\":\"urn:ngsi-ld:Room:B31\",\"type\":\"Room\"}]'"
    When I run "geonic batch delete '[\"urn:ngsi-ld:Room:B30\",\"urn:ngsi-ld:Room:B31\"]'"
    Then the exit code should be 0
    When I run "geonic entities get urn:ngsi-ld:Room:B30"
    Then the exit code should be 1

  Scenario: Batch query entities
    Given I am logged in
    And I run "geonic batch create '[{\"id\":\"urn:ngsi-ld:Room:B40\",\"type\":\"Room\"},{\"id\":\"urn:ngsi-ld:Room:B41\",\"type\":\"Room\"}]'"
    When I run "geonic batch query '{\"entities\":[{\"type\":\"Room\"}]}'"
    Then the exit code should be 0
    And stdout should be valid JSON

  @wip
  Scenario: Batch merge entities
    # Server merge endpoint requires additional fields not yet documented
    Given I am logged in
    And I run "geonic batch create '[{\"id\":\"urn:ngsi-ld:Room:B50\",\"type\":\"Room\"}]'"
    When I run "geonic batch merge '[{\"id\":\"urn:ngsi-ld:Room:B50\",\"temperature\":{\"value\":22,\"type\":\"Property\"}}]'"
    Then the exit code should be 0

  Scenario: entityOperations alias works
    Given I am logged in
    When I run "geonic entityOperations create '[{\"id\":\"urn:ngsi-ld:Room:B60\",\"type\":\"Room\"}]'"
    Then the exit code should be 0
    When I run "geonic entities get urn:ngsi-ld:Room:B60"
    Then the exit code should be 0
    And stdout should be valid JSON

  # Stdin input

  Scenario: Batch create via stdin
    Given I am logged in
    When I run "geonic batch create" with stdin:
      """
      [{"id":"urn:ngsi-ld:Room:S10","type":"Room"},{"id":"urn:ngsi-ld:Room:S11","type":"Room"}]
      """
    Then the exit code should be 0
