Feature: Entity types
  As a CLI user
  I want to browse entity types
  So that I can discover what data is available

  Scenario: List entity types
    Given I am logged in
    And I create entity "Room:100" of type "Room"
    When I run "geonic types list"
    Then the exit code should be 0
    And the output should contain "Room"

  Scenario: Get entity type details
    Given I am logged in
    And I create entity "Room:101" of type "Room"
    When I run "geonic types get Room"
    Then the exit code should be 0
    And stdout should be valid JSON
