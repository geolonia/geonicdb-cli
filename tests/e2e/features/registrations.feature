Feature: Registration management
  As a CLI user
  I want to manage context registrations
  So that I can register context sources

  Scenario: List registrations when none exist
    Given I am logged in
    When I run `geonic registrations list`
    Then the exit code should be 0
    And stdout should contain "[]"

  Scenario: Create a registration
    Given I am logged in
    When I run `geonic registrations create '{"type":"ContextSourceRegistration","information":[{"entities":[{"type":"Room"}]}],"endpoint":"http://localhost:4000/source"}'`
    Then the exit code should be 0
    And the output should contain "Registration created."

  Scenario: List registrations after creation
    Given I am logged in
    And I run `geonic registrations create '{"type":"ContextSourceRegistration","information":[{"entities":[{"type":"Room"}]}],"endpoint":"http://localhost:4000/source"}'`
    When I run `geonic registrations list`
    Then the exit code should be 0
    And the output should contain "Room"

  Scenario: Get registration by ID
    Given I am logged in
    And I run `geonic registrations create '{"type":"ContextSourceRegistration","information":[{"entities":[{"type":"Room"}]}],"endpoint":"http://localhost:4000/source"}'`
    And I run `geonic registrations list --format json`
    And I save the ID from the JSON output
    When I run `geonic registrations get $ID` replacing ID
    Then the exit code should be 0
    And stdout should be valid JSON

  Scenario: Delete a registration
    Given I am logged in
    And I run `geonic registrations create '{"type":"ContextSourceRegistration","information":[{"entities":[{"type":"Room"}]}],"endpoint":"http://localhost:4000/source"}'`
    And I run `geonic registrations list --format json`
    And I save the ID from the JSON output
    When I run `geonic registrations delete $ID` replacing ID
    Then the exit code should be 0
    And the output should contain "Registration deleted."

  @wip
  Scenario: List registrations with count
    # Server does not return NGSILD-Results-Count header for csourceRegistrations
    Given I am logged in
    And I run `geonic registrations create '{"type":"ContextSourceRegistration","information":[{"entities":[{"type":"Room"}]}],"endpoint":"http://localhost:4000/source"}'`
    When I run `geonic registrations list --count`
    Then the exit code should be 0
    And the output should contain "Count:"
