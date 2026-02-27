Feature: Profile management
  As a CLI user
  I want to manage multiple server profiles
  So that I can easily switch between environments

  Scenario: List profiles when none exist
    Given no config file exists
    When I run "profile list"
    Then the exit code should be 0
    And the output should contain "default"

  Scenario: Create a new profile
    Given no config file exists
    When I run "profile create staging"
    Then the exit code should be 0
    And the output should contain "staging"

  Scenario: Switch active profile
    Given a v2 config with profiles:
      """
      {
        "activeProfile": "default",
        "profiles": {
          "default": { "url": "http://localhost:1026" },
          "staging": { "url": "http://staging:1026" }
        }
      }
      """
    When I run "profile use staging"
    Then the exit code should be 0
    And the active profile should be "staging"

  Scenario: Show profile details
    Given a v2 config with profiles:
      """
      {
        "activeProfile": "default",
        "profiles": {
          "default": { "url": "http://localhost:1026", "service": "myservice" }
        }
      }
      """
    When I run "profile show default"
    Then the exit code should be 0
    And the output should contain "http://localhost:1026"

  Scenario: Delete a profile
    Given a v2 config with profiles:
      """
      {
        "activeProfile": "default",
        "profiles": {
          "default": { "url": "http://localhost:1026" },
          "staging": { "url": "http://staging:1026" }
        }
      }
      """
    When I run "profile delete staging"
    Then the exit code should be 0
    And the config should not have profile "staging"

  Scenario: Cannot delete default profile
    Given a v2 config with profiles:
      """
      {
        "activeProfile": "default",
        "profiles": {
          "default": { "url": "http://localhost:1026" }
        }
      }
      """
    When I run "profile delete default"
    Then the exit code should be 1

  Scenario: Cannot create duplicate profile
    Given a v2 config with profiles:
      """
      {
        "activeProfile": "default",
        "profiles": {
          "default": { "url": "http://localhost:1026" },
          "staging": { "url": "http://staging:1026" }
        }
      }
      """
    When I run "profile create staging"
    Then the exit code should be 1

  Scenario: Cannot switch to non-existent profile
    Given a v2 config with profiles:
      """
      {
        "activeProfile": "default",
        "profiles": {
          "default": { "url": "http://localhost:1026" }
        }
      }
      """
    When I run "profile use nonexistent"
    Then the exit code should be 1

  Scenario: Cannot delete active profile
    Given a v2 config with profiles:
      """
      {
        "activeProfile": "staging",
        "profiles": {
          "default": { "url": "http://localhost:1026" },
          "staging": { "url": "http://staging:1026" }
        }
      }
      """
    When I run "profile delete staging"
    Then the exit code should be 1

  Scenario: Cannot show non-existent profile
    Given a v2 config with profiles:
      """
      {
        "activeProfile": "default",
        "profiles": {
          "default": { "url": "http://localhost:1026" }
        }
      }
      """
    When I run "profile show nonexistent"
    Then the exit code should be 1
