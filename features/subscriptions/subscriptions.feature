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
