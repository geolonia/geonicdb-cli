Feature: Stdin and JSON5 input
  As a CLI user
  I want to pipe JSON via stdin without the "-" argument
  So that I can use the CLI more naturally in pipelines

  Scenario: Create entity via stdin (without -)
    Given I am logged in
    When I run "geonic entities create" with stdin:
      """
      {"id":"urn:ngsi-ld:Room:S01","type":"Room"}
      """
    Then the exit code should be 0
    And the output should contain "Entity created."

  Scenario: Batch create via stdin
    Given I am logged in
    When I run "geonic batch create" with stdin:
      """
      [{"id":"urn:ngsi-ld:Room:S10","type":"Room"},{"id":"urn:ngsi-ld:Room:S11","type":"Room"}]
      """
    Then the exit code should be 0

  Scenario: Create entity with JSON5 syntax
    Given I am logged in
    When I run "geonic entities create" with stdin:
      """
      {id: 'urn:ngsi-ld:Room:S02', type: 'Room'}
      """
    Then the exit code should be 0
    And the output should contain "Entity created."
