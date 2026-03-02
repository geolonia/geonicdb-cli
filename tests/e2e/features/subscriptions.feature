Feature: Subscription management
  As a CLI user
  I want to manage context subscriptions
  So that I can receive notifications about entity changes

  Scenario: Create a subscription
    Given I am logged in
    When I run `geonic subscriptions create '{"type":"Subscription","description":"Notify on Room changes","entities":[{"type":"Room"}],"watchedAttributes":["temperature"],"notification":{"endpoint":{"uri":"http://localhost:3000/notify"},"attributes":["temperature"]}}'`
    Then the exit code should be 0
    And the output should contain "Subscription created."

  Scenario: List subscriptions
    Given I am logged in
    And I run `geonic subscriptions create '{"type":"Subscription","description":"Notify on Room changes","entities":[{"type":"Room"}],"watchedAttributes":["temperature"],"notification":{"endpoint":{"uri":"http://localhost:3000/notify"},"attributes":["temperature"]}}'`
    When I run `geonic subscriptions list`
    Then the exit code should be 0
    And the output should contain "Room"

  Scenario: Delete a subscription
    Given I am logged in
    And I run `geonic subscriptions create '{"type":"Subscription","description":"Notify on Room changes","entities":[{"type":"Room"}],"watchedAttributes":["temperature"],"notification":{"endpoint":{"uri":"http://localhost:3000/notify"},"attributes":["temperature"]}}'`
    And I run `geonic subscriptions list --format json`
    And I save the ID from the JSON output
    When I run `geonic subscriptions delete $ID` replacing ID
    Then the exit code should be 0
    And the output should contain "Subscription deleted."

  Scenario: Get subscription by ID
    Given I am logged in
    And I run `geonic subscriptions create '{"type":"Subscription","description":"Notify on Room changes","entities":[{"type":"Room"}],"watchedAttributes":["temperature"],"notification":{"endpoint":{"uri":"http://localhost:3000/notify"},"attributes":["temperature"]}}'`
    And I run `geonic subscriptions list --format json`
    And I save the ID from the JSON output
    When I run `geonic subscriptions get $ID` replacing ID
    Then the exit code should be 0
    And stdout should be valid JSON
    And the JSON output should have key "id"

  Scenario: Update a subscription
    Given I am logged in
    And I run `geonic subscriptions create '{"type":"Subscription","description":"Notify on Room changes","entities":[{"type":"Room"}],"watchedAttributes":["temperature"],"notification":{"endpoint":{"uri":"http://localhost:3000/notify"},"attributes":["temperature"]}}'`
    And I run `geonic subscriptions list --format json`
    And I save the ID from the JSON output
    When I run `geonic subscriptions update $ID '{"description":"Updated subscription"}'` replacing ID
    Then the exit code should be 0
    And the output should contain "Subscription updated."
    When I run `geonic subscriptions get $ID` replacing ID
    Then the exit code should be 0
    And stdout should be valid JSON
    And the output should contain "Updated subscription"

  Scenario: List subscriptions with count
    Given I am logged in
    And I run `geonic subscriptions create '{"type":"Subscription","description":"Notify on Room changes","entities":[{"type":"Room"}],"watchedAttributes":["temperature"],"notification":{"endpoint":{"uri":"http://localhost:3000/notify"},"attributes":["temperature"]}}'`
    When I run `geonic subscriptions list --count`
    Then the exit code should be 0
    And stdout should be valid JSON

  Scenario: List subscriptions with limit
    Given I am logged in
    And I run `geonic subscriptions create '{"type":"Subscription","description":"Notify on Room changes","entities":[{"type":"Room"}],"watchedAttributes":["temperature"],"notification":{"endpoint":{"uri":"http://localhost:3000/notify"},"attributes":["temperature"]}}'`
    And I run `geonic subscriptions create '{"type":"Subscription","description":"Notify on Car changes","entities":[{"type":"Car"}],"watchedAttributes":["temperature"],"notification":{"endpoint":{"uri":"http://localhost:3000/notify"},"attributes":["temperature"]}}'`
    When I run `geonic subscriptions list --limit 1 --format json`
    Then the exit code should be 0
    And stdout should be valid JSON
    And the JSON array length should be 1
