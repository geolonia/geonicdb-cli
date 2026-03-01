Feature: Subscription management
  As a CLI user
  I want to manage context subscriptions
  So that I can receive notifications about entity changes

  Scenario: Create a subscription
    Given I am logged in
    When I create a subscription for type "Room"
    Then the exit code should be 0
    And the output should contain "Subscription created."

  Scenario: List subscriptions
    Given I am logged in
    And I create a subscription for type "Room"
    When I run "geonic subscriptions list"
    Then the exit code should be 0
    And the output should contain "Room"

  Scenario: Delete a subscription
    Given I am logged in
    And I create a subscription for type "Room"
    And I get the subscription ID from the list
    When I delete the subscription
    Then the exit code should be 0
    And the output should contain "Subscription deleted."

  Scenario: Get subscription by ID
    Given I am logged in
    And I create a subscription for type "Room"
    And I get the subscription ID from the list
    When I get the subscription by ID
    Then the exit code should be 0
    And stdout should be valid JSON
    And the JSON output should have key "id"

  Scenario: Update a subscription
    Given I am logged in
    And I create a subscription for type "Room"
    And I get the subscription ID from the list
    When I update the subscription with '{"description":"Updated subscription"}'
    Then the exit code should be 0
    And the output should contain "Subscription updated."

  Scenario: List subscriptions with count
    Given I am logged in
    And I create a subscription for type "Room"
    When I run "geonic subscriptions list --count"
    Then the exit code should be 0
    And stdout should be valid JSON

  Scenario: List subscriptions with limit
    Given I am logged in
    And I create a subscription for type "Room"
    And I create a subscription for type "Car"
    When I run "geonic subscriptions list --limit 1 --format json"
    Then the exit code should be 0
    And stdout should be valid JSON
    And the JSON array length should be 1
