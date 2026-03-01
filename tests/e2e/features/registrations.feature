@wip
Feature: Registration management
  # Server does not implement /ngsi-ld/v1/registrations routes
  As a CLI user
  I want to manage context registrations
  So that I can register context sources

  Scenario: List registrations when none exist
    Given I am logged in
    When I run "geonic registrations list"
    Then the exit code should be 0
    And stdout should contain "[]"

  Scenario: Create a registration
    Given I am logged in
    When I create a registration for type "Room"
    Then the exit code should be 0
    And the output should contain "Registration created."

  Scenario: List registrations after creation
    Given I am logged in
    And I create a registration for type "Room"
    When I run "geonic registrations list"
    Then the exit code should be 0
    And the output should contain "Room"

  Scenario: Get registration by ID
    Given I am logged in
    And I create a registration for type "Room"
    And I get the registration ID from the list
    When I get the registration by ID
    Then the exit code should be 0
    And stdout should be valid JSON

  Scenario: Delete a registration
    Given I am logged in
    And I create a registration for type "Room"
    And I get the registration ID from the list
    When I delete the registration
    Then the exit code should be 0
    And the output should contain "Registration deleted."

  Scenario: List registrations with count
    Given I am logged in
    And I create a registration for type "Room"
    When I run "geonic registrations list --count"
    Then the exit code should be 0
    And the output should contain "Count:"
